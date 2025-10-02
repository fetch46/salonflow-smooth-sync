import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

// Shadcn-inspired color options
const colorOptions = [
  { name: "Zinc", value: "240 5.9% 10%", foreground: "0 0% 98%" },
  { name: "Slate", value: "215.4 16.3% 46.9%", foreground: "0 0% 98%" },
  { name: "Blue", value: "221.2 83.2% 53.3%", foreground: "0 0% 98%" },
  { name: "Green", value: "142.1 76.2% 36.3%", foreground: "0 0% 98%" },
  { name: "Orange", value: "24.6 95% 53.1%", foreground: "0 0% 98%" },
  { name: "Red", value: "0 72.2% 50.6%", foreground: "0 0% 98%" },
  { name: "Rose", value: "346.8 77.2% 49.8%", foreground: "0 0% 98%" },
  { name: "Violet", value: "262.1 83.3% 57.8%", foreground: "0 0% 98%" },
  { name: "Yellow", value: "47.9 95.8% 53.1%", foreground: "0 0% 9%" },
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
                className="w-4 h-4 rounded-full border border-border" 
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