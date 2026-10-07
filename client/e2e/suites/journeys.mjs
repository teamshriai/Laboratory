// Suite 3, journeys: the laboratory's main workflows end to end, by role,
// through accessible names, on a desktop and a phone.
import { MATRIX, options } from '../lib/config.mjs'
import { Journey, letters } from '../lib/journey.mjs'
import { appPath } from '../lib/browser.mjs'
import { fail } from '../lib/report.mjs'
import { runPool } from '../lib/pool.mjs'

const name = (re) => ({ name: re })

/** The specimen id behind an accession number (from its page URL). */
async function sampleId(j, accession) {
  await j.go(`/reception?status=all&q=${encodeURIComponent(accession)}`)
  await j.press(j.page.getByRole('link', name(accession)).first())
  await j.page.waitForURL(/\/specimens\//)
  return new URL(j.page.url()).pathname.split('/').pop()
}

/** (a) Register, order, label, collect, receive, enter (critical), authorise, release, share. */
async function specimenToReport(j) {
  const page = await j.open('receptionist')
  const patient = `Journey ${letters(6)}`
  j.data.patient = patient
  await j.step('register a patient', async () => {
    await j.go('/patients?new=1')
    const dialog = page.getByRole('dialog', name(/register new patient/i))
    await dialog.getByLabel(/full name/i).fill(patient)
    await j.press(dialog.getByRole('radio', name(/^male$/i)))
    await dialog.getByLabel(/date of birth/i).fill('1984-03-15')
    await dialog.getByLabel(/mobile number/i).fill('9845012345')
    await j.press(dialog.getByRole('button', name(/^register patient$/i)))
    await j.toast(/registered/i)
  })
  await j.step('open the new patient', async () => {
    const opened = await page
      .waitForURL(/\/patients\/pat_/, { timeout: 4000 })
      .then(() => true)
      .catch(() => false)
    await j.expect(
      'registering opens the patient page',
      opened,
      `after "Register patient" the URL stays ${page.url()}`,
    )
    if (!opened) await j.press(page.getByRole('link', name(patient)).first())
    await page.getByRole('heading', { level: 1, name: patient }).waitFor()
  })
  await j.step('start a lab order', async () => {
    await j.press(page.getByRole('link', name(/new lab order/i)))
    await page.getByRole('heading', { level: 1, name: /new lab order/i }).waitFor()
    await page.getByText(patient).first().waitFor()
    await j.press(page.getByRole('button', name(/^continue$/i)))
  })
  await j.step('order details', async () => {
    await j.pick(page.getByRole('combobox', name(/ordering doctor/i)))
    await j.press(page.getByRole('button', name(/^continue$/i)))
    await page.getByText(/step 3 of 5/i).waitFor()
  })
  await j.step('pick two tests', async () => {
    await j.press(page.getByRole('button', name(/^serum electrolytes/i)))
    await j.press(page.getByRole('button', name(/^fasting blood sugar/i)))
    const basket = page.locator('main').getByRole('complementary')
    await basket.getByRole('button', name(/^remove /i)).nth(1).waitFor()
    await j.press(page.getByRole('button', name(/^continue$/i)))
    await page.getByText(/step 4 of 5/i).waitFor()
    await j.press(page.getByRole('button', name(/^continue$/i)))
    await page.getByText(/step 5 of 5/i).waitFor()
  })
  await j.step('create the order and print labels', async () => {
    await j.press(page.getByRole('button', name(/create & print labels/i)))
    const text = await j.toast(/order .* created/i)
    j.data.orderNo = text.match(/ORD-[\w-]+/)?.[0]
    const labels = page.getByRole('dialog', name(/print specimen labels/i))
    await j.press(labels.getByRole('button', name(/^print \d+ labels?$/i)))
    await j.toast(/sent to the printer/i)
    await labels.waitFor({ state: 'hidden' })
    j.data.printed = await page
      .waitForFunction(() => window.__e2ePrinted > 0, null, { timeout: 4000 })
      .then(() => true)
      .catch(() => false)
    // The order drawer lists the accession numbers the labels carry.
    const drawer = page.getByRole('dialog', name(new RegExp(j.data.orderNo)))
    const sst = drawer.getByRole('link', name(/^SST LAB-/))
    const fluoride = drawer.getByRole('link', name(/^Fluoride LAB-/))
    j.data.sst = (await sst.innerText()).match(/LAB-[\d-]+/)[0]
    j.data.fluoride = (await fluoride.innerText()).match(/LAB-[\d-]+/)[0]
  })
  await j.expect('labels went to the printer', j.data.printed, 'window.print() was not called')
  await j.step('phlebotomist opens the collection queue', async () => {
    await j.as('phlebotomist', `/collection?q=${encodeURIComponent(patient)}`)
    await page.getByRole('button', name(/^collect$/i)).nth(1).waitFor()
  })
  for (const tube of ['sst', 'fluoride'])
    await j.step(`collect the ${tube} specimen`, async () => {
      const accession = j.data[tube]
      const attempt = async () => {
        // The row of this tube carries its own Collect button.
        await j.go(`/collection?q=${encodeURIComponent(accession)}`)
        await j.press(page.getByRole('button', name(/^collect$/i)).first())
        const dialog = page.getByRole('dialog', name(/collect specimen/i))
        await dialog.getByText(accession).first().waitFor()
        await j.pick(dialog.getByRole('combobox', name(/patient identified by/i)))
        const fasting = dialog.getByRole('combobox', name(/fasting status/i))
        if (await fasting.count()) await j.pick(fasting, /^fasting/i)
        await j.press(dialog.getByRole('button', name(/mark as collected/i)))
        return j.toast(new RegExp(`${accession}.*collected`, 'i'))
      }
      await j.sameMinute(
        'the default collection time is accepted',
        attempt,
        /before the order was placed/i,
      )
    })
  await j.step('technician receives the specimens', async () => {
    await j.as('technician', '/reception')
    // Chilled transport suits every storage condition but frozen.
    await j.press(page.getByRole('radio', name(/chilled/i)))
    for (const tube of ['sst', 'fluoride']) {
      const box = page.getByRole('textbox', name(/accession no/i)).first()
      await box.fill(j.data[tube])
      await j.press(page.getByRole('button', name(/^receive$/i)).first())
      await j.toast(new RegExp(`${j.data[tube]} received`, 'i'))
    }
  })
  await j.step('open result entry for the serum specimen', async () => {
    j.data.sstId = await sampleId(j, j.data.sst)
    j.data.fluorideId = await sampleId(j, j.data.fluoride)
    await j.go(`/results/${j.data.sstId}`)
    await page.getByRole('heading', { level: 1, name: /enter results/i }).waitFor()
  })
  await j.step('enter results with a critical potassium', async () => {
    await page.getByRole('textbox', name(/^sodium$/i)).fill('140')
    await page.getByRole('textbox', name(/^potassium$/i)).fill('7.2')
    await page.getByRole('textbox', name(/^chloride$/i)).fill('102')
    await j.press(page.getByRole('button', name(/submit for verification/i)))
    // The blocking critical-value dialog: acknowledge and call later.
    const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog', name(/critical value/i)))
    await dialog.first().waitFor()
    await j.press(dialog.first().getByRole('button', name(/communicate now/i)))
  })
  await j.step('record the critical call with read-back', async () => {
    await page.waitForURL(/\/critical-results\?.*alert=/)
    const alertUrl = appPath(page.url())
    let first = true
    const attempt = async () => {
      if (!first) await j.go(alertUrl)
      first = false
      const dialog = page.getByRole('dialog', name(/communicate critical value/i))
      await dialog.waitFor()
      await j.press(dialog.getByRole('checkbox', name(/read the value back/i)))
      await j.press(dialog.getByRole('button', name(/record acknowledgement/i)))
      return j.toast(/acknowledgement recorded/i)
    }
    await j.sameMinute('the default call time is accepted', attempt, /missing or not valid/i)
  })
  await j.step('enter the fasting glucose', async () => {
    await j.go(`/results/${j.data.fluorideId}`)
    const box = page.getByRole('main').getByRole('textbox').first()
    await box.fill('92')
    await j.press(page.getByRole('button', name(/submit for verification/i)))
    await j.toast(/submitted for verification/i)
  })
  await j.step('pathologist opens verification', async () => {
    await j.as('pathologist', '/verification?stage=review')
    await page.getByRole('searchbox', name(/search/i)).fill(patient)
    await page.getByRole('button', name(new RegExp(patient))).nth(1).waitFor()
  })
  for (const test of ['electrolytes', 'fasting glucose'])
    await j.step(`verify and authorise the ${test}`, async () => {
      await j.press(page.getByRole('button', name(new RegExp(patient))).first())
      await j.press(page.getByRole('button', name(/^verify and authorise$/i)))
      await j.toast(/authorised/i)
    })
  await j.step('open the report', async () => {
    await j.go(`/reports?q=${encodeURIComponent(patient)}`)
    await j.press(page.getByRole('main').getByRole('link', name(/^RPT-/)).first())
    await page.waitForURL(/\/reports\/rpt_/)
  })
  await j.step('release the report', async () => {
    await j.press(page.getByRole('button', name(/^release (final )?report$/i)).first())
    const dialog = page.getByRole('dialog', name(/sign and release/i))
    await j.press(dialog.getByRole('button', name(/^sign and release$/i)))
    await j.toast(/released/i)
  })
  await j.step('create a share link', async () => {
    await j.press(page.getByRole('button', name(/^share$/i)).first())
    const dialog = page.getByRole('dialog', name(/share report/i))
    await j.press(dialog.getByRole('button', name(/create share link/i)))
    await j.toast(/share link ready|link created/i)
    const link = dialog.getByRole('link', name(/open patient view/i)).first()
    const href = await link.getAttribute('href', { timeout: 5000 }).catch(() => null)
    j.data.shareLink = href
  })
}

const JOURNEYS = {
  a: ['specimen to report', specimenToReport],
}

export async function run(browser) {
  const only = process.env.E2E_JOURNEY?.split(',')
  const jobs = []
  for (const viewport of MATRIX.journeyViewports)
    for (const [id, [title, fn]] of Object.entries(JOURNEYS))
      if (!only || only.includes(id)) jobs.push({ id, title, fn, viewport })
  console.log(`[journeys] ${jobs.length} journeys`)
  await runPool(
    jobs,
    options.workers,
    async ({ id, title, fn, viewport }) => {
      const j = new Journey(browser, id, title, viewport)
      try {
        await fn(j)
        if (process.env.E2E_EXPLORE)
          await j.step('EXPLORE', () => {
            throw new Error('exploring')
          })
      } finally {
        await j.close()
      }
    },
    (job, e) =>
      fail({ suite: 'journeys', check: `journey ${job.id}`, viewport: job.viewport, symptom: 'journey crashed', detail: e.message.split('\n')[0] }),
  )
}
