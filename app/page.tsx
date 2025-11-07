import { CategoryGrid } from "@/components/category-grid"
import { BackgroundAnimation } from "@/components/background-animation"

export default function Home() {
  return (
    <main className="relative min-h-screen bg-gray-80 overflow-hidden">
      <BackgroundAnimation />

      <div className="relative z-10 container mx-auto px-4 py-8">
        <header className="text-center mb-12 space-y-4">
          <h1 className="text-3xl md:text-3xl font-bold text-balance bg-gradient-to-br from-primary via-accent to-secondary bg-clip-text text-gray-600">
            Affirmaition
          </h1>
          <p className="text-lg md:text-lg text-muted-foreground max-w-2xl mx-auto text-blue-800 text-pretty">
            Generate personalized affirmations to nurture your mind, body, and soul
          </p>
        </header>

        <CategoryGrid />
      </div>
    </main>
  )
}
