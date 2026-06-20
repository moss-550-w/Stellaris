/**
 * 工具 —— 科普数据
 *
 * 按天体类型提供简短科普卡内容（标题 + 一句话简介 + 趣味知识点）。
 * 内容面向大众科普，配合选中天体时展示。
 */
import type { BodyType } from '@/physics/types';

export interface ScienceCard {
  title: string;
  intro: string;
  facts: string[];
}

const CARDS: Record<BodyType, ScienceCard> = {
  star: {
    title: '恒星',
    intro: '由引力束缚、核心进行核聚变而自发光的炽热等离子体球。',
    facts: [
      '质量越大，寿命越短——燃料消耗远快于引力束缚的增益。',
      '太阳每秒将约 6 亿吨氢聚变为氦。',
      '恒星的颜色反映表面温度：蓝白最热，红色最冷。',
    ],
  },
  rocky: {
    title: '岩质行星',
    intro: '以硅酸盐岩石与金属为主、拥有固态表面的行星。',
    facts: [
      '太阳系中水星、金星、地球、火星均属岩质行星。',
      '位于「宜居带」的岩质行星，表面可能存在液态水。',
      '自转与磁场影响其能否长期保有大气层。',
    ],
  },
  gas: {
    title: '气态巨行星',
    intro: '主要由氢、氦组成、没有明确固态表面的大型行星。',
    facts: [
      '木星是太阳系最大行星，质量是其余行星总和的 2.5 倍。',
      '标志性的条带由不同高度、不同速度的大气环流形成。',
      '强大引力使其常成为内侧行星的「清道夫」，吸走撞击天体。',
    ],
  },
  blackhole: {
    title: '黑洞',
    intro: '引力极强、连光也无法逃脱的时空区域，边界称为事件视界。',
    facts: [
      '视界之内的信息无法传出，故呈现「全黑」。',
      '吸积盘是落入物质因摩擦升温而发出强光的高温气体盘。',
      '强引力会弯曲其后方星光，形成「引力透镜」效应。',
    ],
  },
};

export function scienceCard(type: BodyType): ScienceCard {
  return CARDS[type];
}
