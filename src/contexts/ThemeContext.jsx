export function ThemeProvider({ children }) {
  return (
    <>
      <style>{`
        html, body, #root { background-color: #07070F; color: #e9feff; }
        body {
          background-image:
            radial-gradient(circle at 10% 40%, rgba(108,92,231,0.05) 0%, transparent 60%),
            radial-gradient(circle at 90% 70%, rgba(71,214,255,0.04) 0%, transparent 60%);
        }
      `}</style>
      {children}
    </>
  )
}