import Image from 'next/image'
import { asset } from '@/lib/asset'

/** Logo + name lockup, shared by the landing chrome and the docs nav. */
export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <Image
        src={asset('/assets/logo.png')}
        alt=""
        width={size}
        height={size}
        className="rounded-md"
      />
      <span className="font-mono text-sm font-semibold tracking-tight">
        opencode-onboard
      </span>
    </span>
  )
}
