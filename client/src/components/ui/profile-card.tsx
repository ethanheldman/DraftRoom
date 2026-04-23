import { useState, useEffect } from "react"
import { Instagram, Twitter } from "lucide-react"

interface ProfileCardProps {
  name?: string
  title?: string
  avatarUrl?: string
  backgroundUrl?: string
  likes?: number
  posts?: number
  views?: number
  likesLabel?: string
  postsLabel?: string
  viewsLabel?: string
  instagramUrl?: string
  twitterUrl?: string
  threadsUrl?: string
  hideSocial?: boolean
  hideFollow?: boolean
}

export function ProfileCard({
  name = "Bhomik Chauhan",
  title = "Product Designer who focuses on simplicity & usability.",
  avatarUrl = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop",
  backgroundUrl = "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=400&fit=crop",
  likes = 72900,
  posts = 828,
  views = 342900,
  likesLabel = "Likes",
  postsLabel = "Posts",
  viewsLabel = "Views",
  instagramUrl = "https://instagram.com",
  twitterUrl = "https://twitter.com",
  threadsUrl = "https://threads.net",
  hideSocial = false,
  hideFollow = false,
}: ProfileCardProps) {
  const [isFollowing, setIsFollowing] = useState(false)
  const [expProgress, setExpProgress] = useState(0)
  const [animatedLikes, setAnimatedLikes] = useState(0)
  const [animatedPosts, setAnimatedPosts] = useState(0)
  const [animatedViews, setAnimatedViews] = useState(0)

  // Animate experience bar
  useEffect(() => {
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        setExpProgress((prev) => {
          if (prev >= 65) {
            clearInterval(interval)
            return 65
          }
          return prev + 1
        })
      }, 20)
      return () => clearInterval(interval)
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  // Animate counters
  useEffect(() => {
    const duration = 2000
    const steps = 60
    const stepDuration = duration / steps

    const likesIncrement = likes / steps
    const postsIncrement = posts / steps
    const viewsIncrement = views / steps

    let currentStep = 0

    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        currentStep++
        setAnimatedLikes(Math.min(Math.floor(likesIncrement * currentStep), likes))
        setAnimatedPosts(Math.min(Math.floor(postsIncrement * currentStep), posts))
        setAnimatedViews(Math.min(Math.floor(viewsIncrement * currentStep), views))

        if (currentStep >= steps) {
          clearInterval(interval)
        }
      }, stepDuration)
      return () => clearInterval(interval)
    }, 500)

    return () => clearTimeout(timer)
  }, [likes, posts, views])

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="bg-card rounded-[2rem] shadow-lg overflow-hidden">
        {/* Header with background */}
        <div className="relative h-40 overflow-hidden">
          <img
            src={backgroundUrl}
            alt="Background"
            className="w-full h-full object-cover opacity-60"
          />

          {/* Follow button */}
          {!hideFollow && (
            <button
              onClick={() => setIsFollowing(!isFollowing)}
              className={`absolute top-4 right-4 rounded-full px-6 py-2 text-sm font-medium transition-all duration-300 ${
                isFollowing
                  ? "bg-card text-card-foreground border-2 border-border hover:bg-secondary"
                  : "bg-card text-card-foreground hover:bg-secondary"
              }`}
            >
              {isFollowing ? "Following" : "Follow"}
              <span className="ml-2 text-lg">{isFollowing ? "✓" : "+"}</span>
            </button>
          )}
        </div>

        {/* Profile content */}
        <div className="px-6 pb-6 -mt-12">
          {/* Avatar */}
          <div className="relative w-24 h-24 mb-4">
            <div className="w-full h-full rounded-full border-4 border-card overflow-hidden bg-card shadow-lg">
              <img
                src={avatarUrl}
                alt={name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Experience bar */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-muted-foreground font-light">exp.</span>
              <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 via-pink-500 via-orange-400 via-yellow-400 via-green-400 to-blue-500 transition-all duration-300 ease-out"
                  style={{ width: `${expProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Name and title */}
          <h2 className="text-2xl font-semibold text-card-foreground mb-2 tracking-tight">
            {name}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6 font-light">
            {title}
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6 py-4 border-t border-b border-border">
            <div className="text-center">
              <div className="text-2xl font-semibold text-card-foreground mb-1">
                {formatNumber(animatedLikes)}
              </div>
              <div className="text-xs text-muted-foreground font-light">{likesLabel}</div>
            </div>
            <div className="text-center border-l border-r border-border">
              <div className="text-2xl font-semibold text-card-foreground mb-1">
                {formatNumber(animatedPosts)}
              </div>
              <div className="text-xs text-muted-foreground font-light">{postsLabel}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-card-foreground mb-1">
                {formatNumber(animatedViews)}
              </div>
              <div className="text-xs text-muted-foreground font-light">{viewsLabel}</div>
            </div>
          </div>

          {/* Social icons */}
          {!hideSocial && <div className="flex justify-center gap-8">
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
              aria-label="Instagram Profile"
            >
              <Instagram className="w-5 h-5 text-card-foreground" />
            </a>
            <a
              href={twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
              aria-label="Twitter Profile"
            >
              <Twitter className="w-5 h-5 text-card-foreground" />
            </a>
            <a
              href={threadsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
              aria-label="Threads Profile"
            >
              {/* Threads logo */}
              <svg
                className="w-5 h-5 text-card-foreground"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.028-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.789-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.28-.883-2.29-.887h-.04c-.76 0-1.621.195-2.408 1.02l-1.494-1.44c1.133-1.178 2.541-1.805 4.11-1.806h.055c3.323.017 5.312 2.07 5.51 5.593.049.09.095.18.139.27.655 1.365.912 3.885-.657 5.822-1.683 2.075-4.08 2.99-7.394 3.011zm.951-8.543c-.024 0-.048 0-.073.001-1.007.057-1.755.327-2.224.8-.346.357-.51.813-.482 1.322.044.826.628 1.448 1.671 1.525.119.008.24.012.36.012.904 0 1.66-.286 2.25-.852.705-.678 1.081-1.7 1.149-3.102a11.57 11.57 0 0 0-2.651.294z"/>
              </svg>
            </a>
          </div>}

        </div>
      </div>
    </div>
  )
}
