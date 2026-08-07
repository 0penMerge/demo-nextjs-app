import { DemoAccessGate } from "@/components/demo-access-gate"
import { OpenMergeConsole } from "@/components/openmerge-console"

export default function Home() {
  return (
    <DemoAccessGate>
      <main>
        <OpenMergeConsole />
      </main>
    </DemoAccessGate>
  )
}
