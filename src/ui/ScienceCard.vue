<script setup lang="ts">
import { computed } from 'vue';
import type { SimUIState } from '@/gameplay/SimulationController';
import type { BodyType } from '@/physics/types';
import { scienceCard } from '@/utils/scienceData';

const props = defineProps<{ state: SimUIState; open: boolean }>();
const emit = defineEmits<{ (e: 'toggle'): void }>();

const card = computed(() => (props.state.selected ? scienceCard(props.state.selected.type as BodyType) : null));
</script>

<template>
  <div v-if="card" class="science">
    <button class="toggle" @click="emit('toggle')">
      📖 科普卡：{{ card.title }} <span class="chev">{{ open ? '▾' : '▸' }}</span>
    </button>
    <transition name="expand">
      <div v-if="open" class="body">
        <p class="intro">{{ card.intro }}</p>
        <ul>
          <li v-for="(f, i) in card.facts" :key="i">{{ f }}</li>
        </ul>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.science {
  border-radius: 8px;
  background: rgba(40, 50, 75, 0.5);
  border: 1px solid rgba(120, 150, 220, 0.18);
  overflow: hidden;
}
.toggle {
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  background: transparent;
  border: none;
  color: #cdd6f4;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
}
.chev {
  margin-left: auto;
  opacity: 0.6;
}
.body {
  padding: 0 10px 10px;
}
.intro {
  margin: 0 0 8px;
  font-size: 11px;
  line-height: 1.5;
  opacity: 0.85;
}
ul {
  margin: 0;
  padding-left: 16px;
}
li {
  font-size: 11px;
  line-height: 1.6;
  opacity: 0.75;
}
.expand-enter-active,
.expand-leave-active {
  transition: all 0.22s ease;
  max-height: 200px;
}
.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
