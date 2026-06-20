// 全屏三角形/四边形顶点着色器：直接透传 NDC 坐标与 UV
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
