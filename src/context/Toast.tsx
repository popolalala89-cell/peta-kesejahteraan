import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'warning'

interface ToastMsg {
  id: number
  text: string
  type: ToastType
}

interface ToastCtx {
  showToast: (text: string, type?: ToastType) => void
}

const Ctx = createContext<ToastCtx>({ showToast: () => {} })

export function useToast() {
  return useContext(Ctx)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const nextId = useRef(1)

  const showToast = useCallback((text: string, type: ToastType = 'success') => {
    const id = nextId.current++
    setToasts((t) => [...t, { id, text, type }])
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
    }, 3500)
  }, [])

  return (
    <Ctx.Provider value={{ showToast }}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}