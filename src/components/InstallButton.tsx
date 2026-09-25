import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

/**
 * "Install app": uses the browser's install prompt where supported (Android,
 * desktop Chrome/Edge); on iPhone/iPad explains Add to Home Screen instead.
 */
export function InstallButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)
  const [showIosHelp, setShowIosHelp] = useState(false)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed || (!promptEvent && !isIos())) return null

  async function install() {
    if (promptEvent) {
      await promptEvent.prompt()
      const { outcome } = await promptEvent.userChoice
      if (outcome === 'accepted') setInstalled(true)
      setPromptEvent(null)
    } else {
      setShowIosHelp((v) => !v)
    }
  }

  return (
    <>
      <button className="btn" onClick={install}>
        Install app
      </button>
      {showIosHelp && (
        <span className="notice" style={{ margin: 0 }}>
          In Safari, tap <strong>Share</strong> (the square with an arrow), then <strong>Add to Home Screen</strong>.
        </span>
      )}
    </>
  )
}
