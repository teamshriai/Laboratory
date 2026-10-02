import { createContext, useContext } from 'react'

/**
 * What a `Field` tells the control inside it (its id for the label, and the
 * hint or error it is described by). Controls read it when they are wrapped
 * in something that does not pass props on, such as react-hook-form's
 * `Controller`, so the label still names them.
 */
export interface FieldControl {
  id: string
  'aria-invalid'?: true | undefined
  'aria-describedby'?: string | undefined
}

export const FieldContext = createContext<FieldControl | null>(null)

export const useFieldControl = () => useContext(FieldContext)
