// 合并后处理单通道 Shader（CLAUDE.md：替代多 Pass）
// 集成：引力透镜屏幕空间畸变 → 阈值化高斯 bloom → ACES 色调映射 → 暗角(vignette)。
// 单次全屏绘制完成全部效果，避免多 RT 往返。
precision highp float;

varying vec2 vUv;

uniform sampler2D tScene;   // 场景渲染结果
uniform vec2 uResolution;
uniform float uBloomStrength;
uniform float uBloomThreshold;
uniform float uVignette;

// 引力透镜（最多 1 个黑洞，正对时启用全屏偏折）
uniform float uLensActive;   // 0/1
uniform vec2 uLensCenter;    // 屏幕 UV
uniform float uLensRadius;   // UV 半径
uniform float uLensStrength; // 偏折强度（随夹角衰减）

// —— 引力透镜：将采样 UV 朝黑洞中心方向拉拽，半径内畸变、视界内压黑 ——
vec2 applyLens(vec2 uv) {
  if (uLensActive < 0.5) return uv;
  vec2 d = uv - uLensCenter;
  d.x *= uResolution.x / uResolution.y; // 纵横比校正
  float r = length(d);
  if (r > uLensRadius) return uv;
  float t = r / uLensRadius;
  // 越靠近中心偏折越强（1/t 型，夹紧）
  float bend = uLensStrength * (1.0 - t) * (1.0 - t);
  vec2 dir = normalize(uv - uLensCenter);
  return uv - dir * bend;
}

// —— 阈值化亮度提取 ——
vec3 threshold(vec3 c) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return l > uBloomThreshold ? c * (l - uBloomThreshold) : vec3(0.0);
}

// —— 9-tap 十字高斯，近似 bloom 模糊（性能与质量折中）——
vec3 bloom(vec2 uv) {
  vec2 px = 1.0 / uResolution;
  vec3 sum = vec3(0.0);
  float weights[5];
  weights[0] = 0.227; weights[1] = 0.194; weights[2] = 0.121; weights[3] = 0.054; weights[4] = 0.016;
  sum += threshold(texture2D(tScene, uv).rgb) * weights[0];
  for (int i = 1; i < 5; i++) {
    float fi = float(i) * 1.5;
    sum += threshold(texture2D(tScene, uv + vec2(px.x * fi, 0.0)).rgb) * weights[i];
    sum += threshold(texture2D(tScene, uv - vec2(px.x * fi, 0.0)).rgb) * weights[i];
    sum += threshold(texture2D(tScene, uv + vec2(0.0, px.y * fi)).rgb) * weights[i];
    sum += threshold(texture2D(tScene, uv - vec2(0.0, px.y * fi)).rgb) * weights[i];
  }
  return sum;
}

// —— ACES filmic 色调映射（Narkowicz 近似）——
vec3 acesToneMap(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec2 uv = applyLens(vUv);

  vec3 color = texture2D(tScene, uv).rgb;
  color += bloom(uv) * uBloomStrength;
  color = acesToneMap(color);

  // 暗角
  vec2 vd = vUv - 0.5;
  float vig = 1.0 - dot(vd, vd) * uVignette;
  color *= clamp(vig, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
