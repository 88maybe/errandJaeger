# Draws the app icon (a 3x3 bingo grid with a route dot) as PNGs. No dependencies.
# Run: python3 scripts/make-icons.py
import struct, zlib

BG = (11, 18, 15)
MINT = (116, 201, 163)
GOLD = (227, 196, 99)
LINES = [(0, 132, 61), (218, 41, 28), (237, 139, 0), (0, 61, 165)]

def draw(size, pad_ratio=0.16):
    px = [[BG for _ in range(size)] for _ in range(size)]
    pad = int(size * pad_ratio)
    gap = max(2, size // 40)
    cell = (size - 2 * pad - 2 * gap) // 3
    r = max(2, cell // 6)
    for row in range(3):
        for col in range(3):
            x0 = pad + col * (cell + gap)
            y0 = pad + row * (cell + gap)
            colour = GOLD if (row, col) == (1, 1) else (MINT if (row + col) % 2 == 0 else LINES[(row * 3 + col) % 4])
            for y in range(y0, y0 + cell):
                for x in range(x0, x0 + cell):
                    dx = max(x0 + r - x, 0, x - (x0 + cell - 1 - r))
                    dy = max(y0 + r - y, 0, y - (y0 + cell - 1 - r))
                    if dx * dx + dy * dy <= r * r:
                        px[y][x] = colour
    return px

def png(path, px):
    h = len(px); w = len(px[0])
    raw = b"".join(b"\x00" + bytes(c for p in row for c in p) for row in px)
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    open(path, "wb").write(data)

png("app/icon.png", draw(64))
png("app/apple-icon.png", draw(180))
png("public/icon-192.png", draw(192))
png("public/icon-512.png", draw(512))
png("public/icon-maskable-512.png", draw(512, 0.24))  # extra safe area for round masks
print("icons written")
