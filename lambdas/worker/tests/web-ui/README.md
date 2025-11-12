# RDA Image Generator - Web UI

Visual testing interface for the Worker Lambda with drag-and-drop image uploads.

## Quick Start

```bash
npm run test:web-ui
```

Then open your browser to: **http://localhost:3000**

## Features

✅ **Visual Image Upload**
- Drag & drop images directly into the browser
- Or click to browse and select files
- Preview images before generation
- Support for multiple input images (multi-modal)

✅ **Real-time Feedback**
- See progress as images generate
- View enhanced prompts
- Display generation metadata (duration, cost, mode)
- Side-by-side comparison of input and output

✅ **Testing Controls**
- Toggle between Mock (free) and Real ($0.003) modes
- Select aspect ratio (1:1 square or 1.91:1 wide)
- Custom prompt input with enhancement

✅ **Results Management**
- Download generated images
- View test history
- Clear all test data

## How It Works

1. **Enter a prompt** - Describe the image you want to generate
2. **Upload images** (optional) - Add product photos or reference images for multi-modal fusion
3. **Choose settings** - Mock/Real mode and aspect ratio
4. **Generate** - Click the button and watch the progress
5. **View results** - See your generated image with metadata

## Multi-Modal Example

To test product integration (like the headphones example):

1. Upload a product image (e.g., headphones photo)
2. Upload a scene image (e.g., person running)
3. Enter prompt: "Professional advertisement featuring these headphones on this person"
4. Click Generate
5. See the preservation-focused prompt enhancement in action!

## Architecture

- **Frontend**: Simple HTML/CSS/JS (no framework needed)
- **Backend**: Express.js server (lightweight)
- **Integration**: Uses existing Worker Lambda with mock services
- **Storage**: Local filesystem (tests/local/output/)

## Endpoints

- `GET /` - Web UI
- `POST /api/generate` - Generate image with uploads
- `GET /api/image/:jobId/:imageId` - Retrieve generated image
- `GET /api/results` - View all test results
- `DELETE /api/results` - Clear test data

## Notes

- Runs entirely locally - no cloud deployment needed
- Uses same mock services as terminal tests
- Perfect for visual testing and demos
- No authentication required (local testing only)

## Port Conflict?

If port 3000 is already in use, edit `server.js` and change the `PORT` constant.

## Stopping the Server

Press `Ctrl+C` in the terminal where the server is running.
