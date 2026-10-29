# OpenComp 🎬
### Professional Node-Based VFX Compositing Workstation (Foundry Nuke Alternative)

**OpenComp** is an open-source, high-performance node-based digital compositing application built from the ground up to mirror the workflow, mathematical precision, and user experience of **Foundry Nuke**.

---

## 🌟 Key Features & Nuke Equivalents

| Feature | Foundry Nuke | OpenComp |
| :--- | :--- | :--- |
| **Pipeline Precision** | 32-bit Floating Point Linear | ✅ 32-bit Float (`Float32Array`) Linear Light Pipeline |
| **Graph Architecture** | Directed Acyclic Graph (DAG) | ✅ Pull-based DAG with dirty flag cache invalidation |
| **Compositing Math** | A/B Stream Operations (Over, Plus, Screen, etc.) | ✅ Exact Nuke formulas for 16 blend modes |
| **Grading Engine** | Exact Nuke Grade Math ($A x + B$) | ✅ Blackpoint, Whitepoint, Lift, Gain, Mult, Offset, Gamma |
| **VFX Keying** | Chroma Keyer + Green/Blue Despill | ✅ Primatte/Nuke style Chroma Keyer + Auto Despill + Luma Key |
| **Dual Viewport** | 1 - 9 Multi-Input Viewer + A/B Wipe | ✅ Interactive A/B split-screen wipe with drag divider |
| **Node Spawner** | `Tab` key quick search | ✅ `Tab` key popup with fuzzy search |
| **Color Isolation** | RGBA, R, G, B, A, Luma isolation | ✅ One-click channel isolation buttons |
| **Pixel Inspector** | Live $(X, Y)$ and Float $RGBA$ values | ✅ Live pixel coordinates, float $RGBA$ readout |

---

## 🚀 Quick Start (Running OpenComp)

OpenComp requires **zero heavy setup or compilation**. You can run it instantly using any of the following:

### Method 1: One-Click Windows Launcher (Easiest)
Simply double-click:
```text
OpenComp/run.bat
```
*(Automatically detects your environment and opens OpenComp in your default browser).*

### Method 2: Open `index.html` Directly
Double-click `OpenComp/index.html` in Windows File Explorer.

### Method 3: Local Node Server (Recommended for loading custom local footage)
```bash
cd OpenComp
node server.js
```
Then open `http://localhost:8080/` in your browser.

---

## ⌨️ Foundry Nuke Keyboard Shortcuts in OpenComp

| Shortcut | Action |
| :--- | :--- |
| **`Tab`** | Open Quick Node Spawner popup (Type node name & press Enter) |
| **`1` - `9`** | Connect selected node to Viewer Input (e.g. `1` for Output, `2` for Background) |
| **`M`** | Create **Merge** Node |
| **`G`** | Create **Grade** Node |
| **`C`** | Create **ColorCorrect** Node |
| **`B`** | Create **Blur** Node |
| **`T`** | Create **Transform** Node |
| **`K`** | Create **Keyer** Node |
| **`R`** | Create **Read** Node |
| **`O`** | Create **Roto** Node |
| **`.`** | Create **Dot** Node (routing) |
| **`D`** | **Disable / Bypass** selected node (Draws red 'X' over node) |
| **`Del` / `Backspace`** | Delete selected node |
| **`F`** | **Fit Image** to Viewport |
| **`H`** | **1:1 Actual Size** Viewport |
| **`Space`** | Play / Pause Timeline |
| **`,` / `.`** | Step Frame Backward / Forward |
| **Middle Mouse** | Pan Node Graph & Viewport canvas |
| **Mouse Wheel** | Zoom Node Graph & Viewport canvas |

---

## 🛠️ Built-in Node Reference

1. **`Read` Node**:
   - Supports local image uploads or procedural VFX generators:
     - `Greenscreen VFX Footage` (actor with hair details, green background, and edge spill).
     - `Cyberpunk City Background` (HD skyline with glowing lights).
     - `Nuke Checkerboard` (calibration test pattern).
     - `Color Ramp Gradient` & `Color Wheel`.
2. **`Merge` Node**:
   - Primary `B` (Background), secondary `A` (Foreground), and `mask` inputs.
   - Operations: `over`, `under`, `plus` (add), `multiply`, `screen`, `difference`, `in`, `out`, `atop`, `color-burn`, `color-dodge`, `hypot`, `xor`, `min`, `max`, `average`.
   - `mix` slider ($0.0 \to 1.0$) and mask invert.
3. **`Grade` Node**:
   - Exact Foundry Nuke Grade algorithm:
     $$A = \text{multiply} \times \frac{\text{gain} - \text{lift}}{\text{whitepoint} - \text{blackpoint}}$$
     $$B = \text{offset} + \text{lift} - A \times \text{blackpoint}$$
     $$\text{output} = (A \times \text{input} + B)^\gamma$$
   - Black clamp, White clamp, Reverse toggle.
4. **`Keyer` Node**:
   - Professional VFX Chroma Keyer (Greenscreen / Bluescreen).
   - Real-time green/blue **Despill algorithm** (eliminates green spill reflections on actor's hair and clothes).
   - Core matte clip black and clip white sliders.
   - Output modes: `Premultiplied RGBA + Despill`, `Matte Only`, or `Despilled RGB`.
5. **`Blur` Node**:
   - Two-pass separable Gaussian blur (Horizontal pass + Vertical pass) with sub-pixel sampling.
   - Aspect ratio slider for anamorphic lens bokeh.
6. **`Transform` Node**:
   - Translation $X/Y$, Rotation (degrees), Scale, Aspect, and Center pivot with bilinear filtering.
7. **`Roto` Node**:
   - Ellipse, Rectangle, and Vignette shapes with feather/softness and invert controls.
8. **`Viewer` Node**:
   - Multi-input switcher (Inputs 1 - 4).
   - Real-time A/B Horizontal & Vertical Wipe comparison bar.
9. **`Write` Node**:
   - One-click render export to PNG, WebP, or JPEG.

---

## 📁 Preloaded Demos (Presets Menu)

Under the **Presets** menu in OpenComp, you can instantly test:
1. **VFX Greenscreen Keying & BG Merge**: Reads foreground actor on greenscreen $\to$ Keyer (with despill) $\to$ Grade $\to$ Merge Over Cyberpunk City Background $\to$ Viewer!
2. **Cinematic Color Grade & Glow**: ColorCorrect $\to$ High-Pass Gaussian Blur $\to$ Grade Glow $\to$ Merge Plus $\to$ Viewer!
3. **A/B Wipe Comparison**: Compare graded footage with raw original footage using the interactive split wipe bar!

