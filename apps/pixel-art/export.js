// PNG 내보내기: 데이터에서 512×512 투명 배경 PNG Blob을 만든다.

const OUTPUT_SIZE = 512;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/;

function pad(value, length) {
  return String(value).padStart(length, '0');
}

// 'pixel-art-YYYYMMDD-HHmmss.png' (로컬 시각, 숫자만 사용)
export function formatFileName(date) {
  const day = `${pad(date.getFullYear(), 4)}${pad(date.getMonth() + 1, 2)}${pad(date.getDate(), 2)}`;
  const time = `${pad(date.getHours(), 2)}${pad(date.getMinutes(), 2)}${pad(date.getSeconds(), 2)}`;
  return `pixel-art-${day}-${time}.png`;
}

// 화면 캔버스를 복사하지 않고 별도 캔버스에 칸마다 fillRect로 칠한다.
// 칸 경계가 정수 픽셀이라 보간이 없고, 칠하지 않은 칸은 투명으로 남는다.
export function createPngBlob(cells, gridSize) {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const context = canvas.getContext('2d');
      if (!context) {
        resolve(null);
        return;
      }
      context.imageSmoothingEnabled = false;

      const scale = OUTPUT_SIZE / gridSize;
      cells.forEach((color, index) => {
        if (typeof color !== 'string' || !COLOR_PATTERN.test(color)) return;
        const x = index % gridSize;
        const y = Math.floor(index / gridSize);
        context.fillStyle = color;
        context.fillRect(x * scale, y * scale, scale, scale);
      });

      canvas.toBlob((blob) => resolve(blob), 'image/png');
    } catch (error) {
      resolve(null);
    }
  });
}
