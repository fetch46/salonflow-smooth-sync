import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

// Predefined color options
const colorOptions = [
  { name: "Blue", value: "220 70% 50%", foreground: "0 0% 98%" },
  { name: "Purple", value: "270 70% 55%", foreground: "0 0% 98%" },
  { name: "Green", value: "142 70% 45%", foreground: "0 0% 98%" },
  { name: "Orange", value: "25 95% 53%", foreground: "0 0% 98%" },
  { name: "Red", value: "0 72% 51%", foreground: "0 0% 98%" },
  { name: "Pink", value: "330 81% 60%", foreground: "0 0% 98%" },
  { name: "Cyan", value: "199 89% 48%", foreground: "0 0% 98%" },
  { name: "Black", value: "0 0% 9%", foreground: "0 0% 98%" },
  { name: "Gray", value: "0 0% 45%", foreground: "0 0% 98%" },
]

export function ThemeColorPicker() {
  const [selectedColor, setSelectedColor] = useState(colorOptions[0])

  useEffect(() => {
    // Get the current theme color from CSS variables
    const root = document.documentElement
    const currentPrimary = getComputedStyle(root).getPropertyValue('--theme-primary').trim()
    
    if (currentPrimary) {
      const matchingColor = colorOptions.find(color => color.value === currentPrimary)
      if (matchingColor) {
        setSelectedColor(matchingColor)
      }
    }
  }, [])

  const applyThemeColor = (color: typeof colorOptions[0]) => {
    const root = document.documentElement
    
    // Set theme primary color
    root.style.setProperty('--theme-primary', color.value)
    root.style.setProperty('--theme-primary-foreground', color.foreground)
    
    // Calculate lighter variant for hover states
    const [hue, saturation, lightness] = color.value.split(' ')
    const lighterLightness = Math.min(parseInt(lightness.replace('%', '')) + 10, 90)
    root.style.setProperty('--theme-primary-light', `${hue} ${saturation} ${lighterLightness}%`)
    
    // Store in localStorage for persistence
    localStorage.setItem('theme-primary', color.value)
    localStorage.setItem('theme-primary-foreground', color.foreground)
    localStorage.setItem('theme-primary-light', `${hue} ${saturation} ${lighterLightness}%`)
    
    setSelectedColor(color)
  }

  // Load saved theme on component mount
  useEffect(() => {
    const savedPrimary = localStorage.getItem('theme-primary')
    const savedForeground = localStorage.getItem('theme-primary-foreground')
    const savedLight = localStorage.getItem('theme-primary-light')
    
    if (savedPrimary && savedForeground) {
      const root = document.documentElement
      root.style.setProperty('--theme-primary', savedPrimary)
      root.style.setProperty('--theme-primary-foreground', savedForeground)
      if (savedLight) {
        root.style.setProperty('--theme-primary-light', savedLight)
      }
      
      const matchingColor = colorOptions.find(color => color.value === savedPrimary)
      if (matchingColor) {
        setSelectedColor(matchingColor)
      }
    }
  }, [])

  return (
    <div className="card-premium p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg">
          <div className="w-5 h-5 rounded-full bg-white/20" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Theme Colors</h3>
          <p className="text-sm text-muted-foreground">Choose your app's primary color</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {colorOptions.map((color) => (
            <button
              key={color.name}
              onClick={() => applyThemeColor(color)}
              className={`
                relative h-16 rounded-xl border-2 transition-all duration-300 group
                ${selectedColor.name === color.name 
                  ? 'border-current shadow-lg scale-105' 
                  : 'border-border hover:border-current hover:scale-105'
                }
              `}
              style={{
                backgroundColor: `hsl(${color.value})`,
                color: `hsl(${color.foreground})`
              }}
            >
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/10 to-transparent" />
              <div className="relative flex flex-col items-center justify-center gap-1 h-full">
                <div 
                  className="w-6 h-6 rounded-full border-2 border-white/30 shadow-sm" 
                  style={{ backgroundColor: `hsl(${color.value})` }}
                />
                <span className="text-xs font-medium">{color.name}</span>
              </div>
              {selectedColor.name === color.name && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-md">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="glass-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Current Selection</span>
            <div className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded-full border border-border shadow-sm" 
                style={{ backgroundColor: `hsl(${selectedColor.value})` }}
              />
              <span className="text-sm font-semibold text-foreground">{selectedColor.name}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            This color will be applied to buttons, active navigation, and interactive elements throughout your app.
          </p>
        </div>
      </div>
    </div>
  )
}