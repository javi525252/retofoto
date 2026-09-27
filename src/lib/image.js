export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Comprime a JPEG, máx. 1280px de lado, sin recortar (todo el encuadre se conserva).
export function compressImage(img, maxSide = 1280, quality = 0.82) {
  let { width, height } = img;
  if (width > height && width > maxSide) {
    height = Math.round((height * maxSide) / width);
    width = maxSide;
  } else if (height >= width && height > maxSide) {
    width = Math.round((width * maxSide) / height);
    height = maxSide;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}
