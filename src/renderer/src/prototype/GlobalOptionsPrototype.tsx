// PROTOTYP – wybiera wariant ekranu edytora według `?variant=`.
import type { PrototypeVariant } from './prototypeVariant'
import type { PrototypeShellProps } from './shell'
import { VariantA } from './variantA/VariantA'
import { VariantB } from './variantB/VariantB'
import { VariantC } from './variantC/VariantC'

export function GlobalOptionsPrototype({ variant, ...props }: PrototypeShellProps & { variant: Exclude<PrototypeVariant, 'current'> }) {
  if (variant === 'A') return <VariantA {...props} />
  if (variant === 'B') return <VariantB {...props} />
  return <VariantC {...props} />
}
