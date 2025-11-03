import { createCanvas, loadImage } from 'canvas';
import fetch from 'node-fetch';

export class POAPCollage {
    constructor() {
        this.imageSize = 200; // Size of each POAP image in the grid
        this.gridSize = 3; // 3x3 grid
        this.padding = 10; // Padding between images
    }

    async createCollage(poapUrls) {
        try {
            // Limit to 9 images maximum (3x3 grid)
            const urls = poapUrls.slice(0, 9);
            const canvasSize = (this.imageSize * this.gridSize) + (this.padding * (this.gridSize + 1));
            
            // Create canvas
            const canvas = createCanvas(canvasSize, canvasSize);
            const ctx = canvas.getContext('2d');
            
            // Fill background
            ctx.fillStyle = '#2C2F33'; // Discord dark theme color
            ctx.fillRect(0, 0, canvasSize, canvasSize);
            
            // Load and draw images
            for (let i = 0; i < urls.length; i++) {
                try {
                    // Calculate grid position
                    const row = Math.floor(i / this.gridSize);
                    const col = i % this.gridSize;
                    const x = this.padding + (col * (this.imageSize + this.padding));
                    const y = this.padding + (row * (this.imageSize + this.padding));
                    
                    // Load image
                    const image = await loadImage(urls[i]);
                    
                    // Draw image with rounded corners
                    this.drawRoundedImage(ctx, image, x, y, this.imageSize, this.imageSize, 10);
                    
                } catch (imageError) {
                    console.error(`Failed to load POAP image ${i}:`, imageError);
                    // Draw placeholder rectangle
                    const row = Math.floor(i / this.gridSize);
                    const col = i % this.gridSize;
                    const x = this.padding + (col * (this.imageSize + this.padding));
                    const y = this.padding + (row * (this.imageSize + this.padding));
                    
                    ctx.fillStyle = '#99AAB5';
                    ctx.fillRect(x, y, this.imageSize, this.imageSize);
                    ctx.fillStyle = '#2C2F33';
                    ctx.font = '16px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('POAP', x + this.imageSize/2, y + this.imageSize/2);
                }
            }
            
            // Return canvas as buffer
            return canvas.toBuffer('image/png');
            
        } catch (error) {
            console.error('Error creating POAP collage:', error);
            throw error;
        }
    }
    
    drawRoundedImage(ctx, img, x, y, width, height, radius) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, radius);
        ctx.clip();
        ctx.drawImage(img, x, y, width, height);
        ctx.restore();
    }
}