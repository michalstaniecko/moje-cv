// PROTOTYP – wariant ekranu edytora według `?variant=` (został tylko A – Inspektor).
import type { PrototypeVariant } from './prototypeVariant'
import type { PrototypeShellProps } from './shell'
import { VariantA } from './variantA/VariantA'

export function GlobalOptionsPrototype(props: PrototypeShellProps & { variant: Exclude<PrototypeVariant, 'current'> }) {
  const { variant: _variant, ...rest } = props
  return <VariantA {...rest} />
}
