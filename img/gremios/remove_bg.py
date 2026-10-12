from PIL import Image
import sys

def process_image(input_path, output_path, is_checker=False):
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()

    newData = []
    for item in datas:
        # Get pixel RGB
        r, g, b, a = item
        
        # If the image has a fake checkerboard (R2D2, Wall-e)
        if is_checker:
            # Checkerboard colors are usually exact #fff and #ccc (or similar)
            # Let's just say if r,g,b are close to each other and above 180 it's a gray/white bg
            # But the robot itself has white and gray!
            pass # We'll do something else for checkerboard
            
        # For white bg (Terminator, Baymax)
        if r > 240 and g > 240 and b > 240:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)

    img.putdata(newData)
    img.save(output_path, "PNG")

if __name__ == "__main__":
    process_image('terminator.png', 'terminator_bg.png')
    process_image('baymax.png', 'baymax_bg.png')
