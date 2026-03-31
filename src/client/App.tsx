import { AppHeader } from "./components/AppHeader"
import { FeatureStudio } from "./components/FeatureStudio"

export default function App() {
    return (
        <div className="min-h-screen bg-stone-50 text-zinc-900">
            <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col">
                <AppHeader />
                <FeatureStudio />
            </div>
        </div>
    )
}
