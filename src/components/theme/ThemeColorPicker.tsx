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
    <Card>
      <CardHeader>
        <CardTitle>Theme Color</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Label>Choose your primary color:</Label>
        <div className="grid grid-cols-3 gap-3">
          {colorOptions.map((color) => (
            <Button
              key={color.name}
              variant={selectedColor.name === color.name ? "default" : "outline"}
              size="sm"
              onClick={() => applyThemeColor(color)}
              className="h-12 flex flex-col gap-1"
              style={{
                backgroundColor: selectedColor.name === color.name ? `hsl(${color.value})` : undefined,
                borderColor: `hsl(${color.value})`,
                color: selectedColor.name === color.name ? `hsl(${color.foreground})` : `hsl(${color.value})`
              }}
            >
              <div 
                className="w-4 h-4 rounded-full border border-white/20" 
                style={{ backgroundColor: `hsl(${color.value})` }}
              />
              <span className="text-xs">{color.name}</span>
            </Button>
          ))}
        </div>
        <div className="mt-4 p-3 bg-muted rounded-md">
          <p className="text-sm text-muted-foreground">
            Current theme: <span className="font-medium text-foreground">{selectedColor.name}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            All buttons, active menus, and tabs will use this color.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}