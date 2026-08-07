import type { Metadata } from "next"
import type { ReactNode } from "react"
import "./styles.css"
import "./access-styles.css"

export const metadata: Metadata = {
  title: "OpenMerge CRM Starter",
  description: "A production-shaped Next.js demo for connecting, syncing, reading, and writing CRM data through OpenMerge.",
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
