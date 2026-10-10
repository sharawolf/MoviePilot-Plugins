import { importShared } from './__federation_fn_import-JrT3xvdd.js';
import { G, W, C, r, R, F, f, M } from './runtime-BCybTabx.js?v=78054f19492aa458';
import { isCustomPet, resolveMascotProfile, createMascotRuntime, petAssetUrls, cloneConfig } from './mascot-runtime.js?v=78054f19492aa458';
import { startAgentMascotPatchEntry } from './agentmascot-loader.js?v=78054f19492aa458';
import { u } from './provider-mBbtEwEX.js?v=78054f19492aa458';

const actionLabels = {
  idle: '待机', walk: '走路', run: '跑步', jump: '跳跃', fall: '下落', land: '落地',
  sleep: '睡觉', drag: '拖拽', resist: '挣扎', think: '思考', surprise: '惊讶',
  cheer: '欢呼', spinCelebrate: '转圈庆祝',
  right: '向右移动', left: '向左移动', waving: '挥手', jumping: '跳跃',
  failed: '失败反应', waiting: '等待回应', working: '专注工作', review: '检查结果',
};
const behaviorLabels = {
  rest: '原地休息', roam: '随机游走', goWall: '去墙边', leap: '飞跃', holdWall: '贴墙停留',
  climbWall: '爬墙', fallFromWall: '墙面下落', goCeiling: '上天花板', holdCeiling: '吸顶停留',
  crawlCeiling: '天花板移动', dropFromCeiling: '天花板下落',
};

function actionGroups(mascot, kind = 'action') {
  if (isCustomPet(mascot)) return kind === 'behavior' ? [] : [{
    id: 'pet', title: 'Pet 原生动作', items: ['idle','right','left','waving','jumping','failed','waiting','working','review'].map(id => ({ id, label: actionLabels[id] })),
  }]
  if (kind === 'behavior') return [
    ['ground', '地面行为', G], ['wall', '墙面行为', W], ['ceiling', '天花板行为', C],
  ].map(([id, title, behaviors]) => ({ id, title, items: r(id, behaviors, mascot).map(b => ({ id: b.id, label: behaviorLabels[b.id] || b.id })) })).filter(g => g.items.length)

  return [
    ['daily', '日常', ['idle', 'sleep', 'think']], ['move', '移动', ['walk', 'run']],
    ['air', '空中', ['jump', 'fall', 'land']], ['interact', '交互', ['drag', 'resist', 'surprise']],
    ['feature', '角色特色', ['cheer', 'spinCelebrate']],
  ].map(([id, title, items]) => ({ id, title, items: items.filter(name => R.includes(name) || (F[mascot] || []).includes(name)).map(id => ({ id, label: actionLabels[id] || id })) })).filter(g => g.items.length)
}

// Shared by the global entry, federated entry and Vue preview.
function createPointerInput({ getRuntime, point, paused = () => false, render = () => {} }) {
  let active = null, start = null, last = null, moved = false, suppressUntil = 0;
  const hover = event => {
    if (event.pointerType && event.pointerType !== 'mouse') getRuntime()?.handlePointerLeave();
    else if (event.isPrimary !== false) getRuntime()?.handlePointerMove(point(event));
    render();
  };
  function down(event) {
    if (paused() || active !== null || event.isPrimary === false || event.button !== 0) return
    event.preventDefault();
    active = event.pointerId;
    moved = false;
    start = last = point(event);
    getRuntime()?.startDrag(start);
    event.currentTarget?.setPointerCapture?.(active);
  }
  function move(event) {
    if (active === null || event.pointerId !== active) return
    const next = point(event);
    if (Math.hypot(next.x - start.x, next.y - start.y) > 5) { moved = true; suppressUntil = Date.now() + 500; }
    getRuntime()?.moveDrag(next, next.x - last.x);
    last = next;
  }
  function end(event) {
    if (active === null || event.pointerId !== active) return
    const cancelled = event.type === 'pointercancel' || event.type === 'lostpointercapture';
    if (cancelled || moved) suppressUntil = Date.now() + 500;
    getRuntime()?.endDrag(cancelled ? last : point(event), 0, 0);
    const id = active;
    active = null;
    if (event.currentTarget?.hasPointerCapture?.(id)) event.currentTarget.releasePointerCapture(id);
  }
  return { hover, down, move, end,
    leave() { getRuntime()?.handlePointerLeave(); },
    suppressClick: () => Date.now() < suppressUntil || getRuntime()?.shouldSuppressClick(),
    reset() { if (active !== null) getRuntime()?.endDrag(last, 0, 0); active = null; start = last = null; },
  }
}

const {createElementVNode:_createElementVNode$2,toDisplayString:_toDisplayString$2,createTextVNode:_createTextVNode$2,resolveComponent:_resolveComponent$2,withCtx:_withCtx$2,createVNode:_createVNode$2,normalizeStyle:_normalizeStyle,unref:_unref$2,normalizeClass:_normalizeClass$2,openBlock:_openBlock$2,createElementBlock:_createElementBlock$2,createCommentVNode:_createCommentVNode$2,renderList:_renderList$2,Fragment:_Fragment$2,createBlock:_createBlock$2} = await importShared('vue');


const _hoisted_1$2 = { class: "am-preview" };
const _hoisted_2$2 = { class: "am-section-heading" };
const _hoisted_3$2 = { class: "am-inline-actions" };
const _hoisted_4$2 = { class: "am-preview-grid" };
const _hoisted_5$2 = { class: "am-stage-caption" };
const _hoisted_6$2 = ["aria-label"];
const _hoisted_7$2 = { class: "am-pet-frame" };
const _hoisted_8$2 = ["src"];
const _hoisted_9$2 = {
  class: "am-action-panel",
  "aria-label": "动作测试"
};
const _hoisted_10$2 = {
  class: "am-subtabs",
  role: "tablist",
  "aria-label": "测试分类"
};
const _hoisted_11$2 = ["aria-selected", "onClick"];
const _hoisted_12$2 = {
  key: 0,
  class: "am-hint"
};
const _hoisted_13$2 = {
  key: 1,
  class: "am-hint"
};
const _hoisted_14$1 = { class: "am-action-scroll" };
const _hoisted_15$1 = { class: "am-action-buttons" };
const _hoisted_16$1 = { class: "am-preview-status" };
const _hoisted_17$1 = { class: "am-debug" };

const {computed: computed$3,onBeforeUnmount: onBeforeUnmount$2,onMounted: onMounted$1,ref: ref$2,shallowRef,watch: watch$1} = await importShared('vue');


const _sfc_main$2 = {
  __name: 'MascotPreview',
  props: { config: { type: Object, required: true } },
  setup(__props) {

const props = __props;
const stage = ref$2(null);
const paused = ref$2(false);
const kind = ref$2('action');
const frame = shallowRef(null);
const metrics = shallowRef({});
const profile = computed$3(() => resolveMascotProfile(props.config.mascot, props.config._pet ? [props.config._pet] : []));
const custom = computed$3(() => isCustomPet(props.config.mascot));
const groups = computed$3(() => actionGroups(props.config.mascot, kind.value));
let runtime;
let observer;
let mediaQuery;
let disposed = false;
const timeouts = new Set();
const input = createPointerInput({ getRuntime: () => runtime, point, paused: () => paused.value });

function bounds() {
  const rect = stage.value?.getBoundingClientRect();
  return { width: rect?.width || 640, height: rect?.height || 320 }
}
function render() {
  if (!runtime || disposed) return
  frame.value = runtime.renderState();
  metrics.value = runtime.debugState();
}
const previewConfig = () => ({ ...props.config, enabled: true });
function updateActivity() {
  if (!runtime) return
  if (paused.value || document.hidden) {
    runtime.stop();
    for (const timer of timeouts) window.clearTimeout(timer);
    timeouts.clear();
  }
  else runtime.start();
  render();
}
function reset() { runtime?.resetPose(); render(); }
function trigger(id) {
  if (kind.value === 'behavior') runtime?.playBehavior(id);
  else runtime?.playAction(id);
  render();
}
function point(event) {
  const rect = stage.value?.getBoundingClientRect();
  return rect ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : null
}
function click() {
  if (!paused.value && !input.suppressClick()) runtime?.celebrate();
}
const petStyle = computed$3(() => frame.value ? {
  width: `${frame.value.size}px`, height: `${frame.value.height || frame.value.size}px`,
  transform: `translate3d(${frame.value.left}px, ${frame.value.top}px, 0) scaleX(${frame.value.flipX ?? (runtime?.pet.lookRight ? -1 : 1)})`,
} : {});
const number = value => Number.isFinite(value) ? value.toFixed(1) : '—';

watch$1(() => props.config, () => { runtime?.updateConfig(previewConfig()); render(); }, { deep: true });
watch$1(custom, () => { kind.value = 'action'; });
watch$1(paused, updateActivity);
onMounted$1(() => {
  mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  paused.value = mediaQuery.matches;
  runtime = createMascotRuntime({
    bounds, getConfig: previewConfig, getSurfaceLanes: context => f(context),
    initialPet: { anchorX: 100, anchorY: 100, targetX: 200, targetY: 100, laneY: 100 },
    onUpdate: render, snapGroundOnDragRelease: true,
    scheduler: {
      setInterval: (...args) => window.setInterval(...args), clearInterval: id => window.clearInterval(id),
      setTimeout: (callback, delay) => {
        const id = window.setTimeout(() => { timeouts.delete(id); if (!disposed) callback(); }, delay);
        timeouts.add(id);
        return id
      },
      clearTimeout: id => { timeouts.delete(id); window.clearTimeout(id); },
      requestAnimationFrame: callback => window.requestAnimationFrame(callback), cancelAnimationFrame: id => window.cancelAnimationFrame(id),
    },
  });
  observer = new ResizeObserver(() => { runtime?.clampToBounds(); render(); });
  observer.observe(stage.value);
  document.addEventListener('visibilitychange', updateActivity);
  updateActivity();
});
onBeforeUnmount$2(() => {
  disposed = true;
  input.reset();
  runtime?.stop();
  for (const timer of timeouts) window.clearTimeout(timer);
  timeouts.clear();
  observer?.disconnect();
  document.removeEventListener('visibilitychange', updateActivity);
});

return (_ctx, _cache) => {
  const _component_VBtn = _resolveComponent$2("VBtn");
  const _component_VIcon = _resolveComponent$2("VIcon");

  return (_openBlock$2(), _createElementBlock$2("div", _hoisted_1$2, [
    _createElementVNode$2("div", _hoisted_2$2, [
      _cache[9] || (_cache[9] = _createElementVNode$2("div", null, [
        _createElementVNode$2("h3", null, "动作预览"),
        _createElementVNode$2("p", null, "使用当前设置演示，保存后应用到页面桌宠。")
      ], -1)),
      _createElementVNode$2("div", _hoisted_3$2, [
        _createVNode$2(_component_VBtn, {
          size: "small",
          variant: "text",
          "prepend-icon": paused.value ? 'mdi-play-outline' : 'mdi-pause',
          onClick: _cache[0] || (_cache[0] = $event => (paused.value = !paused.value))
        }, {
          default: _withCtx$2(() => [
            _createTextVNode$2(_toDisplayString$2(paused.value ? '继续' : '暂停'), 1)
          ]),
          _: 1
        }, 8, ["prepend-icon"]),
        _createVNode$2(_component_VBtn, {
          size: "small",
          variant: "text",
          "prepend-icon": "mdi-restore",
          onClick: reset
        }, {
          default: _withCtx$2(() => [...(_cache[8] || (_cache[8] = [
            _createTextVNode$2("复位", -1)
          ]))]),
          _: 1
        })
      ])
    ]),
    _createElementVNode$2("div", _hoisted_4$2, [
      _createElementVNode$2("div", {
        ref_key: "stage",
        ref: stage,
        class: "am-stage",
        onPointermove: _cache[6] || (_cache[6] = (...args) => (_unref$2(input).hover && _unref$2(input).hover(...args))),
        onPointerleave: _cache[7] || (_cache[7] = (...args) => (_unref$2(input).leave && _unref$2(input).leave(...args)))
      }, [
        _createElementVNode$2("div", _hoisted_5$2, [
          _createElementVNode$2("span", null, _toDisplayString$2(profile.value.label), 1),
          _createElementVNode$2("small", null, _toDisplayString$2(paused.value ? '预览已暂停' : '拖动角色，或单击互动'), 1)
        ]),
        (frame.value)
          ? (_openBlock$2(), _createElementBlock$2("button", {
              key: 0,
              class: _normalizeClass$2(["am-pet", { 'am-pet--shadow': __props.config.shadow }]),
              style: _normalizeStyle(petStyle.value),
              type: "button",
              "aria-label": `与${profile.value.label}互动`,
              onPointerdown: _cache[1] || (_cache[1] = (...args) => (_unref$2(input).down && _unref$2(input).down(...args))),
              onPointermove: _cache[2] || (_cache[2] = (...args) => (_unref$2(input).move && _unref$2(input).move(...args))),
              onPointerup: _cache[3] || (_cache[3] = (...args) => (_unref$2(input).end && _unref$2(input).end(...args))),
              onPointercancel: _cache[4] || (_cache[4] = (...args) => (_unref$2(input).end && _unref$2(input).end(...args))),
              onLostpointercapture: _cache[5] || (_cache[5] = (...args) => (_unref$2(input).end && _unref$2(input).end(...args))),
              onClick: click
            }, [
              _createElementVNode$2("span", _hoisted_7$2, [
                _createElementVNode$2("img", {
                  src: frame.value.frame,
                  style: _normalizeStyle(frame.value.imageStyle),
                  alt: "",
                  draggable: "false"
                }, null, 12, _hoisted_8$2)
              ])
            ], 46, _hoisted_6$2))
          : _createCommentVNode$2("", true),
        _cache[10] || (_cache[10] = _createElementVNode$2("div", {
          class: "am-stage-ground",
          "aria-hidden": "true"
        }, null, -1))
      ], 544),
      _createElementVNode$2("section", _hoisted_9$2, [
        _createElementVNode$2("div", _hoisted_10$2, [
          (_openBlock$2(true), _createElementBlock$2(_Fragment$2, null, _renderList$2([{ id: 'action', label: '单个动作' }, ...(!custom.value ? [{ id: 'behavior', label: '连续行为' }] : [])], (tab) => {
            return (_openBlock$2(), _createElementBlock$2("button", {
              key: tab.id,
              type: "button",
              role: "tab",
              "aria-selected": kind.value === tab.id,
              class: _normalizeClass$2({ 'am-selected': kind.value === tab.id }),
              onClick: $event => (kind.value = tab.id)
            }, _toDisplayString$2(tab.label), 11, _hoisted_11$2))
          }), 128))
        ]),
        (paused.value)
          ? (_openBlock$2(), _createElementBlock$2("p", _hoisted_12$2, "继续预览后可以测试动作。"))
          : _createCommentVNode$2("", true),
        (custom.value)
          ? (_openBlock$2(), _createElementBlock$2("p", _hoisted_13$2, "按原素材播放；爬墙、吸顶和睡觉不适用。" + _toDisplayString$2(__props.config._pet?.version === 2 ? '开启跟随鼠标可体验视线方向。' : ''), 1))
          : _createCommentVNode$2("", true),
        _createElementVNode$2("div", _hoisted_14$1, [
          (_openBlock$2(true), _createElementBlock$2(_Fragment$2, null, _renderList$2(groups.value, (group) => {
            return (_openBlock$2(), _createElementBlock$2("div", {
              key: group.id,
              class: "am-action-group"
            }, [
              _createElementVNode$2("h4", null, _toDisplayString$2(group.title), 1),
              _createElementVNode$2("div", _hoisted_15$1, [
                (_openBlock$2(true), _createElementBlock$2(_Fragment$2, null, _renderList$2(group.items, (item) => {
                  return (_openBlock$2(), _createBlock$2(_component_VBtn, {
                    key: item.id,
                    disabled: paused.value,
                    size: "small",
                    variant: "tonal",
                    onClick: $event => (trigger(item.id))
                  }, {
                    default: _withCtx$2(() => [
                      _createTextVNode$2(_toDisplayString$2(item.label), 1)
                    ]),
                    _: 2
                  }, 1032, ["disabled", "onClick"]))
                }), 128))
              ])
            ]))
          }), 128))
        ])
      ])
    ]),
    _createElementVNode$2("div", _hoisted_16$1, [
      _createVNode$2(_component_VIcon, {
        icon: "mdi-motion-play-outline",
        size: "18"
      }),
      _createTextVNode$2(_toDisplayString$2(_unref$2(actionLabels)[metrics.value.action] || '待机'), 1),
      _cache[11] || (_cache[11] = _createElementVNode$2("span", null, "动作测试仅影响此预览区", -1))
    ]),
    _createElementVNode$2("details", _hoisted_17$1, [
      _cache[12] || (_cache[12] = _createElementVNode$2("summary", null, "调试信息", -1)),
      _createElementVNode$2("dl", null, [
        (_openBlock$2(true), _createElementBlock$2(_Fragment$2, null, _renderList$2({ 表面: metrics.value.surface, 状态: metrics.value.state, 帧: metrics.value.poseIndex, 目标X: number(metrics.value.targetX), 目标Y: number(metrics.value.targetY), 速度X: number(metrics.value.vx), 速度Y: number(metrics.value.vy) }, (value, label) => {
          return (_openBlock$2(), _createElementBlock$2("div", { key: label }, [
            _createElementVNode$2("dt", null, _toDisplayString$2(label), 1),
            _createElementVNode$2("dd", null, _toDisplayString$2(value ?? '—'), 1)
          ]))
        }), 128))
      ])
    ])
  ]))
}
}

};

const {reactive: reactive$1} = await importShared('vue');

function createPetLibraryController({ api, pluginId, onImported, onRemoved }) {
  const state = reactive$1({ busy: false, candidate: null, error: '', notice: '', filename: '', removeId: '' });
  let active = true, generation = 0, file = null;
  async function upload(nextFile, save) {
    if (!active || state.busy) return false
    const request = ++generation;
    state.error = ''; state.notice = '';
    if (!save) { state.candidate = null; file = null; state.filename = ''; }
    if (!nextFile || nextFile.size > 64 * 1024 * 1024 || !/\.zip$/i.test(nextFile.name)) {
      state.error = '请选择不超过 64 MiB 的 ZIP 文件。'; return false
    }
    state.busy = true;
    try {
      const form = new FormData();
      form.append('file', nextFile);
      const data = u(await api.post(`plugin/${pluginId}/pets/${save ? 'import' : 'inspect'}`, form, { feedback: 'silent' }));
      if (!active || request !== generation) return false
      if (!data?.pet?.id || !data.pet.sprite_url) throw new Error('未收到完整的角色信息。')
      if (save) {
        onImported(petAssetUrls(data.pet));
        state.candidate = null; file = null; state.filename = '';
        state.notice = '已加入角色库并选为草稿，点击底部「保存设置」后使用。';
      } else {
        file = nextFile; state.filename = nextFile.name; state.candidate = data.pet;
      }
      return true
    } catch (error) {
      if (active && request === generation) state.error = error.message || '导入失败，请重试。';
      return false
    } finally {
      if (active && request === generation) state.busy = false;
    }
  }
  async function remove() {
    if (!active || state.busy || !state.removeId) return false
    const id = state.removeId, request = ++generation;
    state.busy = true; state.error = ''; state.notice = '';
    try {
      u(await api.delete(`plugin/${pluginId}/pets/${id}`, { feedback: 'silent' }));
      if (!active || request !== generation) return false
      onRemoved(id); state.removeId = ''; state.notice = '角色已移除。';
      return true
    } catch (error) {
      if (active && request === generation) state.error = error.message || '移除失败，请重试。';
      return false
    } finally { if (active && request === generation) state.busy = false; }
  }
  return { state, inspect: next => upload(next, false), save: () => upload(file, true), remove,
    cancel() { if (!state.busy) { file = null; state.candidate = null; state.filename = ''; } },
    suspend() { active = false; generation++; file = null; state.candidate = null; state.busy = false; },
  }
}

const {createElementVNode:_createElementVNode$1,unref:_unref$1,createTextVNode:_createTextVNode$1,resolveComponent:_resolveComponent$1,withCtx:_withCtx$1,createVNode:_createVNode$1,toDisplayString:_toDisplayString$1,openBlock:_openBlock$1,createElementBlock:_createElementBlock$1,createCommentVNode:_createCommentVNode$1,createBlock:_createBlock$1,renderList:_renderList$1,Fragment:_Fragment$1,normalizeClass:_normalizeClass$1} = await importShared('vue');


const _hoisted_1$1 = {
  class: "am-library",
  "aria-label": "导入角色库"
};
const _hoisted_2$1 = { class: "am-section-heading" };
const _hoisted_3$1 = ["disabled"];
const _hoisted_4$1 = {
  key: 0,
  class: "am-library-error",
  role: "alert"
};
const _hoisted_5$1 = {
  key: 1,
  class: "am-hint",
  role: "status"
};
const _hoisted_6$1 = {
  key: 2,
  class: "am-import-preview"
};
const _hoisted_7$1 = { class: "am-section-heading" };
const _hoisted_8$1 = { class: "am-inline-actions" };
const _hoisted_9$1 = {
  key: 3,
  class: "am-import-grid"
};
const _hoisted_10$1 = ["aria-pressed", "disabled", "onClick"];
const _hoisted_11$1 = ["src"];
const _hoisted_12$1 = {
  key: 4,
  class: "am-hint"
};
const _hoisted_13$1 = {
  key: 5,
  class: "am-remove-confirm",
  role: "alert"
};

const {computed: computed$2,onBeforeUnmount: onBeforeUnmount$1,ref: ref$1,watch} = await importShared('vue');


const _sfc_main$1 = {
  __name: 'PetLibrary',
  props: { api: [Object, Function], pluginId: String, pets: Array, config: Object,
  savedId: String, disabled: Boolean },
  emits: ['select', 'imported', 'removed', 'busy'],
  setup(__props, { emit: __emit }) {

const props = __props;
const emit = __emit;
const input = ref$1(null);
const controller = createPetLibraryController({ api: props.api, pluginId: props.pluginId,
  onImported: pet => emit('imported', pet), onRemoved: id => emit('removed', id) });
const { state } = controller;
const previewConfig = computed$2(() => ({ ...props.config, mascot: state.candidate?.id,
  _pet: state.candidate, follow_mouse: true, auto_roam: false }));
watch(() => state.busy, value => emit('busy', value));
function selectFile(event) { const file = event.target.files?.[0]; if (file) void controller.inspect(file); event.target.value = ''; }
onBeforeUnmount$1(() => { controller.suspend(); emit('busy', false); });

return (_ctx, _cache) => {
  const _component_VBtn = _resolveComponent$1("VBtn");

  return (_openBlock$1(), _createElementBlock$1("section", _hoisted_1$1, [
    _createElementVNode$1("div", _hoisted_2$1, [
      _cache[3] || (_cache[3] = _createElementVNode$1("div", null, [
        _createElementVNode$1("h3", null, "导入角色"),
        _createElementVNode$1("p", null, "兼容 Codex Pet v1 / v2 ZIP，角色会保留在插件数据目录。")
      ], -1)),
      _createVNode$1(_component_VBtn, {
        variant: "tonal",
        color: "primary",
        "prepend-icon": "mdi-upload",
        loading: _unref$1(state).busy,
        disabled: __props.disabled,
        onClick: _cache[0] || (_cache[0] = $event => (input.value?.click()))
      }, {
        default: _withCtx$1(() => [...(_cache[2] || (_cache[2] = [
          _createTextVNode$1("导入 Pet", -1)
        ]))]),
        _: 1
      }, 8, ["loading", "disabled"]),
      _createElementVNode$1("input", {
        ref_key: "input",
        ref: input,
        type: "file",
        accept: ".zip,application/zip",
        class: "am-file-input",
        "aria-label": "选择 Pet 压缩包",
        disabled: __props.disabled || _unref$1(state).busy,
        onChange: selectFile
      }, null, 40, _hoisted_3$1)
    ]),
    (_unref$1(state).error)
      ? (_openBlock$1(), _createElementBlock$1("p", _hoisted_4$1, _toDisplayString$1(_unref$1(state).error), 1))
      : _createCommentVNode$1("", true),
    (_unref$1(state).notice)
      ? (_openBlock$1(), _createElementBlock$1("p", _hoisted_5$1, _toDisplayString$1(_unref$1(state).notice), 1))
      : _createCommentVNode$1("", true),
    (_unref$1(state).candidate)
      ? (_openBlock$1(), _createElementBlock$1("section", _hoisted_6$1, [
          _createElementVNode$1("div", _hoisted_7$1, [
            _createElementVNode$1("div", null, [
              _createElementVNode$1("h4", null, _toDisplayString$1(_unref$1(state).candidate.name), 1),
              _createElementVNode$1("p", null, _toDisplayString$1(_unref$1(state).filename) + " · Pet v" + _toDisplayString$1(_unref$1(state).candidate.version), 1)
            ]),
            _createElementVNode$1("div", _hoisted_8$1, [
              _createVNode$1(_component_VBtn, {
                variant: "text",
                disabled: _unref$1(state).busy,
                onClick: _unref$1(controller).cancel
              }, {
                default: _withCtx$1(() => [...(_cache[4] || (_cache[4] = [
                  _createTextVNode$1("取消", -1)
                ]))]),
                _: 1
              }, 8, ["disabled", "onClick"]),
              _createVNode$1(_component_VBtn, {
                color: "primary",
                variant: "flat",
                loading: _unref$1(state).busy,
                disabled: __props.disabled,
                onClick: _unref$1(controller).save
              }, {
                default: _withCtx$1(() => [...(_cache[5] || (_cache[5] = [
                  _createTextVNode$1("保存到角色库", -1)
                ]))]),
                _: 1
              }, 8, ["loading", "disabled", "onClick"])
            ])
          ]),
          (_openBlock$1(), _createBlock$1(_sfc_main$2, {
            key: _unref$1(state).candidate.id,
            config: previewConfig.value
          }, null, 8, ["config"]))
        ]))
      : _createCommentVNode$1("", true),
    (__props.pets?.length)
      ? (_openBlock$1(), _createElementBlock$1("div", _hoisted_9$1, [
          (_openBlock$1(true), _createElementBlock$1(_Fragment$1, null, _renderList$1(__props.pets, (pet) => {
            return (_openBlock$1(), _createElementBlock$1("div", {
              key: pet.id,
              class: "am-import-card"
            }, [
              _createElementVNode$1("button", {
                type: "button",
                class: _normalizeClass$1(["am-character", { 'am-character--selected': __props.config.mascot === pet.id }]),
                "aria-pressed": __props.config.mascot === pet.id,
                disabled: __props.disabled || _unref$1(state).busy,
                onClick: $event => (emit('select', pet.id))
              }, [
                _createElementVNode$1("img", {
                  src: pet.icon,
                  alt: ""
                }, null, 8, _hoisted_11$1),
                _createElementVNode$1("strong", null, _toDisplayString$1(pet.name), 1),
                _createElementVNode$1("small", null, "Pet v" + _toDisplayString$1(pet.version), 1)
              ], 10, _hoisted_10$1),
              _createVNode$1(_component_VBtn, {
                size: "small",
                variant: "text",
                color: "error",
                disabled: __props.disabled || _unref$1(state).busy || __props.savedId === pet.id,
                onClick: $event => (_unref$1(state).removeId = pet.id)
              }, {
                default: _withCtx$1(() => [
                  _createTextVNode$1(_toDisplayString$1(__props.savedId === pet.id ? '正在使用' : '移除'), 1)
                ]),
                _: 2
              }, 1032, ["disabled", "onClick"])
            ]))
          }), 128))
        ]))
      : (!_unref$1(state).candidate)
        ? (_openBlock$1(), _createElementBlock$1("p", _hoisted_12$1, "尚未导入角色。支持仅含 pet.json 和动画图的包，也支持包含素材子目录的完整包。"))
        : _createCommentVNode$1("", true),
    (_unref$1(state).removeId)
      ? (_openBlock$1(), _createElementBlock$1("div", _hoisted_13$1, [
          _createElementVNode$1("span", null, "移除「" + _toDisplayString$1(__props.pets.find(p => p.id === _unref$1(state).removeId)?.name) + "」及其保存的素材？", 1),
          _createVNode$1(_component_VBtn, {
            variant: "text",
            disabled: _unref$1(state).busy,
            onClick: _cache[1] || (_cache[1] = $event => (_unref$1(state).removeId = ''))
          }, {
            default: _withCtx$1(() => [...(_cache[6] || (_cache[6] = [
              _createTextVNode$1("取消", -1)
            ]))]),
            _: 1
          }, 8, ["disabled"]),
          _createVNode$1(_component_VBtn, {
            color: "error",
            variant: "tonal",
            loading: _unref$1(state).busy,
            disabled: __props.disabled,
            onClick: _unref$1(controller).remove
          }, {
            default: _withCtx$1(() => [...(_cache[7] || (_cache[7] = [
              _createTextVNode$1("确认移除", -1)
            ]))]),
            _: 1
          }, 8, ["loading", "disabled", "onClick"])
        ]))
      : _createCommentVNode$1("", true)
  ]))
}
}

};

const hostProps = {
  api: { type: [Object, Function], default: null },
  pluginId: { type: String, default: '' },
  sourcePluginId: { type: String, default: '' },
  navKey: { type: String, default: 'main' },
  initialConfig: { type: Object, default: null },
};

const {computed: computed$1,reactive} = await importShared('vue');

const fingerprint = config => JSON.stringify(cloneConfig(config));
const cancelled = error => error?.name === 'AbortError' || error?.code === 'ERR_CANCELED';

/** Keep the editable draft separate from confirmed server configuration. */
function createConfigController({ api, pluginId, initialConfig = null, onSaved = () => {} }) {
  const state = reactive({
    draft: cloneConfig(initialConfig), saved: cloneConfig(initialConfig),
    ready: Boolean(initialConfig && 'enabled' in initialConfig),
    loading: false, saving: false, error: '', notice: '', pendingReadback: false, pets: [],
  });
  const dirty = computed$1(() => fingerprint(state.draft) !== fingerprint(state.saved));
  let active = true;
  let generation = 0;

  function requireClient(method) {
    if (!pluginId || !api?.[method]) throw new Error('宿主连接尚未就绪，请重新打开插件页面。')
  }

  async function readStatus() {
    requireClient('get');
    const data = u(await api.get(`plugin/${pluginId}/status`, { feedback: 'silent' }));
    if (!data?.config || typeof data.config.enabled !== 'boolean') throw new Error('未取得有效配置，请稍后刷新。')
    return { config: cloneConfig(data.config), pets: (data.pets || []).map(pet => petAssetUrls(pet)) }
  }

  function accept(config, submitted = null) {
    const preserve = dirty.value && (submitted === null || fingerprint(state.draft) !== fingerprint(submitted));
    state.saved = cloneConfig(config);
    if (!preserve) state.draft = cloneConfig(config);
    state.ready = true;
    state.pendingReadback = false;
    return preserve
  }

  async function load() {
    if (!active || state.saving) return false
    const request = ++generation;
    state.loading = true;
    state.error = '';
    try {
      const { config, pets } = await readStatus();
      if (!active || request !== generation) return false
      state.pets = pets;
      const preserved = accept(config);
      state.notice = preserved && dirty.value ? '已刷新已保存配置，当前修改仍保留。' : '已读取最新配置。';
      return true
    } catch (error) {
      if (active && request === generation && !cancelled(error)) state.error = error.message || '读取配置失败，请重试。';
      return false
    } finally {
      if (active && request === generation) state.loading = false;
    }
  }

  async function save() {
    if (!active || !state.ready || state.loading || state.saving || state.pendingReadback || !dirty.value) return false
    const request = ++generation;
    const submitted = cloneConfig(state.draft);
    state.saving = true;
    state.error = '';
    state.notice = '';
    let acknowledged = false;
    try {
      requireClient('put');
      u(await api.put(`plugin/${pluginId}`, submitted, { feedback: 'silent' }));
      acknowledged = true;
      if (!active || request !== generation) return false
      const { config, pets } = await readStatus();
      if (!active || request !== generation) return false
      state.pets = pets;
      accept(config, submitted);
      state.notice = dirty.value ? '本次设置已保存，后续修改尚未保存。' : '设置已保存并回读确认。';
      // UI/session coordination must not turn a confirmed save into a failure.
      try { await onSaved(config); } catch {
        if (active && request === generation) state.notice += ' 桌宠将在下次状态检查时更新。';
      }
      return true
    } catch (error) {
      if (active && request === generation) {
        state.pendingReadback = acknowledged;
        if (!cancelled(error)) state.error = acknowledged
          ? '配置已提交，但回读未完成。请刷新状态确认，当前修改已保留。'
          : `${error.message || '保存失败'} 当前修改已保留。`;
      }
      return false
    } finally {
      if (active && request === generation) state.saving = false;
    }
  }

  function edit(key, value) {
    if (!active || !state.ready || state.saving) return
    state.draft = cloneConfig({ ...state.draft, [key]: value });
    state.notice = '';
  }

  function reset() {
    if (state.saving || state.pendingReadback) return
    state.draft = cloneConfig(state.saved);
    state.notice = '已撤销未保存的修改。';
    state.error = '';
  }

  function suspend() {
    active = false;
    generation++;
    state.loading = false;
    state.saving = false;
  }

  return { state, dirty, load, save, edit, reset, suspend, resume: () => { active = true; } }
}

const {createElementVNode:_createElementVNode,toDisplayString:_toDisplayString,unref:_unref,createTextVNode:_createTextVNode,resolveComponent:_resolveComponent,withCtx:_withCtx,createVNode:_createVNode,openBlock:_openBlock,createBlock:_createBlock,createCommentVNode:_createCommentVNode,renderList:_renderList,Fragment:_Fragment,createElementBlock:_createElementBlock,normalizeClass:_normalizeClass} = await importShared('vue');


const _hoisted_1 = { class: "am-header" };
const _hoisted_2 = { class: "am-brand" };
const _hoisted_3 = { class: "am-brand-avatar" };
const _hoisted_4 = ["src"];
const _hoisted_5 = { class: "am-header-actions" };
const _hoisted_6 = { class: "am-body" };
const _hoisted_7 = {
  class: "am-nav",
  "aria-label": "桌宠设置导航"
};
const _hoisted_8 = {
  key: 0,
  class: "am-empty",
  role: "status"
};
const _hoisted_9 = { class: "am-flow" };
const _hoisted_10 = { class: "am-overview-grid" };
const _hoisted_11 = { class: "am-summary-card" };
const _hoisted_12 = ["src"];
const _hoisted_13 = { class: "am-summary-card" };
const _hoisted_14 = { class: "am-note" };
const _hoisted_15 = { class: "am-note am-note--subtle" };
const _hoisted_16 = { class: "am-overview-actions" };
const _hoisted_17 = { class: "am-section-heading" };
const _hoisted_18 = {
  class: "am-character-grid",
  role: "group",
  "aria-label": "桌宠形象"
};
const _hoisted_19 = ["aria-pressed", "disabled", "onClick"];
const _hoisted_20 = ["src"];
const _hoisted_21 = { class: "am-slider-grid" };
const _hoisted_22 = { class: "am-slider-card" };
const _hoisted_23 = ["id"];
const _hoisted_24 = { class: "am-slider-card" };
const _hoisted_25 = ["id"];
const _hoisted_26 = { class: "am-behaviors" };
const _hoisted_27 = { class: "am-footer" };
const _hoisted_28 = {
  class: "am-feedback",
  role: "alert"
};
const _hoisted_29 = { class: "am-footer-actions" };
const _hoisted_30 = { class: "am-footer-actions" };

const {computed,onActivated,onBeforeUnmount,onDeactivated,onMounted,ref,useId} = await importShared('vue');


const _sfc_main = {
  __name: 'PluginWorkspace',
  props: { ...hostProps, mode: { type: String, default: 'config' } },
  emits: ['close', 'layout'],
  setup(__props, { emit: __emit }) {

const props = __props;
const emit = __emit;
const activeTab = ref(props.mode === 'config' ? 'overview' : 'preview');
const visible = ref(true);
const discardPrompt = ref(false);
const libraryBusy = ref(false);
const fieldId = useId();
const session = ref({ mounted: false, syncing: true, nativeEntryAvailable: false });
const tabs = [
  { key: 'overview', label: '运行总览', icon: 'mdi-view-dashboard-outline', description: '查看已保存设置与当前页面状态' },
  { key: 'basic', label: '基础设置', icon: 'mdi-tune-variant', description: '控制桌宠启用与页面入口' },
  { key: 'appearance', label: '形象与行为', icon: 'mdi-palette-outline', description: '选择角色，调整大小和活动方式' },
  { key: 'preview', label: '动作预览', icon: 'mdi-motion-play-outline', description: '在独立预览区体验角色动作' },
];
const currentTab = computed(() => tabs.find(tab => tab.key === activeTab.value));
const controller = createConfigController({
  api: props.api, pluginId: props.pluginId, initialConfig: props.initialConfig,
  onSaved: async () => {
    if (window.__AgentMascotGlobalLoader?.pluginId === props.pluginId) await window.__AgentMascotGlobalLoader.sync();
    updateSession();
  },
});
const { state, dirty } = controller;
const profile = computed(() => resolveMascotProfile(state.draft.mascot, state.pets));
const savedProfile = computed(() => resolveMascotProfile(state.saved.mascot, state.pets));
const previewConfig = computed(() => ({ ...state.draft, _pet: state.pets.find(pet => pet.id === state.draft.mascot) }));
const busy = computed(() => state.loading || state.saving || libraryBusy.value);
const controlsDisabled = computed(() => !state.ready || busy.value || state.pendingReadback);
const feedback = computed(() => state.saving ? '正在保存并回读配置…' : state.loading ? '正在读取配置…' : state.error || (dirty.value ? '有未保存修改，保存后应用到桌宠。' : state.notice || '配置已同步。'));
let sessionTimer;
let mounted = false;

function updateSession() {
  if (!visible.value) return
  const handle = window.__AgentMascotGlobalLoader;
  session.value = handle?.pluginId === props.pluginId
    ? handle.getState?.() || { mounted: Boolean(document.getElementById('agentmascot-global-root')), syncing: false }
    : { mounted: false, syncing: false, nativeEntryAvailable: false };
}
function startSessionObserver() {
  window.clearInterval(sessionTimer);
  if (!document.hidden) sessionTimer = window.setInterval(updateSession, 2000);
  updateSession();
}
function visibilityChanged() {
  if (document.hidden) window.clearInterval(sessionTimer);
  else if (visible.value) startSessionObserver();
}
async function initialize() {
  if (!await controller.load() || !visible.value) return
  startAgentMascotPatchEntry(window, { api: props.api, pluginId: props.pluginId });
  startSessionObserver();
}
async function refresh() {
  if (await controller.load() && visible.value) {
    const handle = startAgentMascotPatchEntry(window, { api: props.api, pluginId: props.pluginId });
    await handle.sync();
    startSessionObserver();
    updateSession();
  }
}
function close() {
  if (state.saving || libraryBusy.value) return
  if (dirty.value || state.pendingReadback) discardPrompt.value = true;
  else emit('close');
}
function imported(pet) {
  state.pets = [...state.pets.filter(item => item.id !== pet.id), pet];
  controller.edit('mascot', pet.id);
}
function removed(id) {
  state.pets = state.pets.filter(pet => pet.id !== id);
  if (state.draft.mascot === id) controller.edit('mascot', state.saved.mascot);
}
function deactivate() {
  visible.value = false;
  controller.suspend();
  window.clearInterval(sessionTimer);
  document.removeEventListener('visibilitychange', visibilityChanged);
}
onMounted(() => {
  mounted = true;
  emit('layout', { maxWidth: '70rem' });
  document.addEventListener('visibilitychange', visibilityChanged);
  void initialize();
});
onDeactivated(deactivate);
onActivated(() => {
  if (!mounted || visible.value) return
  visible.value = true;
  controller.resume();
  document.addEventListener('visibilitychange', visibilityChanged);
  void initialize();
});
onBeforeUnmount(deactivate);

return (_ctx, _cache) => {
  const _component_VChip = _resolveComponent("VChip");
  const _component_VBtn = _resolveComponent("VBtn");
  const _component_VListItem = _resolveComponent("VListItem");
  const _component_VList = _resolveComponent("VList");
  const _component_VProgressCircular = _resolveComponent("VProgressCircular");
  const _component_VIcon = _resolveComponent("VIcon");
  const _component_VSwitch = _resolveComponent("VSwitch");
  const _component_VCardItem = _resolveComponent("VCardItem");
  const _component_VCard = _resolveComponent("VCard");
  const _component_VSlider = _resolveComponent("VSlider");

  return (_openBlock(), _createElementBlock("section", {
    class: _normalizeClass(["am-workspace", [`am-workspace--${__props.mode}`, { 'am-workspace--overview': activeTab.value === 'overview' }]]),
    "aria-label": "Agent 桌宠控制台"
  }, [
    _createElementVNode("header", _hoisted_1, [
      _createElementVNode("div", _hoisted_2, [
        _createElementVNode("div", _hoisted_3, [
          _createElementVNode("img", {
            src: profile.value.icon,
            alt: ""
          }, null, 8, _hoisted_4)
        ]),
        _createElementVNode("div", null, [
          _createElementVNode("h2", null, _toDisplayString(__props.mode === 'config' ? '桌宠设置' : 'Agent 桌宠'), 1),
          _createElementVNode("p", null, _toDisplayString(currentTab.value.description), 1)
        ])
      ]),
      _createElementVNode("div", _hoisted_5, [
        _createVNode(_component_VChip, {
          class: "am-enabled-chip",
          size: "small",
          color: _unref(state).ready && _unref(state).saved.enabled ? 'success' : 'default',
          variant: "tonal"
        }, {
          default: _withCtx(() => [
            _createTextVNode(_toDisplayString(!_unref(state).ready ? '待读取' : _unref(state).saved.enabled ? '已启用' : '已停用'), 1)
          ]),
          _: 1
        }, 8, ["color"]),
        _createVNode(_component_VBtn, {
          icon: "mdi-refresh",
          size: "small",
          variant: "text",
          loading: _unref(state).loading,
          disabled: _unref(state).saving || libraryBusy.value,
          "aria-label": "刷新状态",
          title: "刷新状态",
          onClick: refresh
        }, null, 8, ["loading", "disabled"]),
        (__props.mode !== 'app')
          ? (_openBlock(), _createBlock(_component_VBtn, {
              key: 0,
              icon: "mdi-close",
              size: "small",
              variant: "text",
              disabled: _unref(state).saving || libraryBusy.value,
              "aria-label": "关闭",
              title: "关闭",
              onClick: close
            }, null, 8, ["disabled"]))
          : _createCommentVNode("", true)
      ])
    ]),
    _createElementVNode("div", _hoisted_6, [
      _createElementVNode("nav", _hoisted_7, [
        _createVNode(_component_VList, {
          nav: "",
          density: "compact",
          class: "am-nav-list"
        }, {
          default: _withCtx(() => [
            (_openBlock(), _createElementBlock(_Fragment, null, _renderList(tabs, (tab) => {
              return _createVNode(_component_VListItem, {
                key: tab.key,
                active: activeTab.value === tab.key,
                color: "primary",
                rounded: "lg",
                "prepend-icon": tab.icon,
                title: tab.label,
                disabled: _unref(state).saving || libraryBusy.value,
                onClick: $event => (activeTab.value = tab.key)
              }, null, 8, ["active", "prepend-icon", "title", "disabled", "onClick"])
            }), 64))
          ]),
          _: 1
        })
      ]),
      _createElementVNode("main", {
        class: _normalizeClass(["am-content", { 'am-content--overview': activeTab.value === 'overview' }])
      }, [
        (!_unref(state).ready)
          ? (_openBlock(), _createElementBlock("div", _hoisted_8, [
              (_unref(state).loading)
                ? (_openBlock(), _createBlock(_component_VProgressCircular, {
                    key: 0,
                    indeterminate: "",
                    color: "primary",
                    size: "32"
                  }))
                : (_openBlock(), _createBlock(_component_VIcon, {
                    key: 1,
                    icon: "mdi-cloud-alert-outline",
                    size: "36",
                    color: "warning"
                  })),
              _createElementVNode("h3", null, _toDisplayString(_unref(state).loading ? '正在读取桌宠设置' : '暂时无法读取设置'), 1),
              _createElementVNode("p", null, _toDisplayString(_unref(state).loading ? '连接就绪后即可调整形象与动作。' : _unref(state).error || '请检查宿主连接后重试。'), 1),
              (!_unref(state).loading)
                ? (_openBlock(), _createBlock(_component_VBtn, {
                    key: 2,
                    variant: "tonal",
                    color: "primary",
                    "prepend-icon": "mdi-refresh",
                    onClick: refresh
                  }, {
                    default: _withCtx(() => [...(_cache[12] || (_cache[12] = [
                      _createTextVNode("重新读取", -1)
                    ]))]),
                    _: 1
                  }))
                : _createCommentVNode("", true)
            ]))
          : (activeTab.value === 'overview')
            ? (_openBlock(), _createElementBlock(_Fragment, { key: 1 }, [
                _cache[25] || (_cache[25] = _createElementVNode("div", { class: "am-section-heading" }, [
                  _createElementVNode("div", null, [
                    _createElementVNode("h3", null, "运行总览"),
                    _createElementVNode("p", null, "以下状态基于已保存设置与当前页面。")
                  ])
                ], -1)),
                _createElementVNode("ol", _hoisted_9, [
                  _createElementVNode("li", {
                    class: _normalizeClass({ 'am-flow--ready': _unref(state).saved.enabled })
                  }, [
                    _cache[14] || (_cache[14] = _createElementVNode("span", null, "1", -1)),
                    _createElementVNode("div", null, [
                      _cache[13] || (_cache[13] = _createElementVNode("strong", null, "启用桌宠", -1)),
                      _createElementVNode("small", null, _toDisplayString(_unref(state).saved.enabled ? '已保存为启用' : '前往基础设置启用'), 1)
                    ])
                  ], 2),
                  _createElementVNode("li", {
                    class: _normalizeClass({ 'am-flow--ready': session.value.mounted })
                  }, [
                    _cache[16] || (_cache[16] = _createElementVNode("span", null, "2", -1)),
                    _createElementVNode("div", null, [
                      _cache[15] || (_cache[15] = _createElementVNode("strong", null, "加载页面形象", -1)),
                      _createElementVNode("small", null, _toDisplayString(session.value.syncing ? '正在检查' : session.value.mounted ? '当前页面已显示' : '当前页面未显示'), 1)
                    ])
                  ], 2),
                  _createElementVNode("li", {
                    class: _normalizeClass({ 'am-flow--ready': session.value.mounted && session.value.nativeEntryAvailable })
                  }, [
                    _cache[18] || (_cache[18] = _createElementVNode("span", null, "3", -1)),
                    _createElementVNode("div", null, [
                      _cache[17] || (_cache[17] = _createElementVNode("strong", null, "连接智能助手", -1)),
                      _createElementVNode("small", null, _toDisplayString(!_unref(state).saved.replace_agent_entry ? '入口替换已关闭' : session.value.mounted && session.value.nativeEntryAvailable ? '原生入口可用' : '等待原生入口就绪'), 1)
                    ])
                  ], 2)
                ]),
                _createElementVNode("div", _hoisted_10, [
                  _createElementVNode("section", _hoisted_11, [
                    _createElementVNode("img", {
                      src: savedProfile.value.icon,
                      alt: ""
                    }, null, 8, _hoisted_12),
                    _createElementVNode("div", null, [
                      _cache[19] || (_cache[19] = _createElementVNode("span", { class: "am-eyebrow" }, "当前形象", -1)),
                      _createElementVNode("strong", null, _toDisplayString(savedProfile.value.label), 1),
                      _createElementVNode("p", null, "大小 " + _toDisplayString(_unref(state).saved.scale.toFixed(2)) + "× · 速度 " + _toDisplayString(_unref(state).saved.speed.toFixed(2)) + "×", 1)
                    ])
                  ]),
                  _createElementVNode("section", _hoisted_13, [
                    _createVNode(_component_VIcon, {
                      icon: "mdi-cursor-default-outline",
                      size: "30",
                      color: "primary"
                    }),
                    _createElementVNode("div", null, [
                      _cache[20] || (_cache[20] = _createElementVNode("span", { class: "am-eyebrow" }, "活动方式", -1)),
                      _createElementVNode("strong", null, _toDisplayString(_unref(state).saved.auto_roam ? '自动游走' : '自由互动'), 1),
                      _createElementVNode("p", null, _toDisplayString(_unref(state).saved.follow_mouse ? '跟随鼠标' : '不跟随鼠标') + " · " + _toDisplayString(_unref(state).saved.shadow ? '显示阴影' : '隐藏阴影'), 1)
                    ])
                  ])
                ]),
                _createElementVNode("section", _hoisted_14, [
                  _createVNode(_component_VIcon, {
                    icon: "mdi-information-outline",
                    size: "22",
                    color: "primary"
                  }),
                  _cache[21] || (_cache[21] = _createElementVNode("div", null, [
                    _createElementVNode("h4", null, "刷新后，重新打开一次桌宠页面"),
                    _createElementVNode("p", null, "打开侧栏「Agent 桌宠」或插件详情即可加载，随后切换页面会保留。整页刷新后需要再次打开。")
                  ], -1))
                ]),
                _createElementVNode("section", _hoisted_15, [
                  _createVNode(_component_VIcon, {
                    icon: "mdi-lifebuoy",
                    size: "22"
                  }),
                  _cache[22] || (_cache[22] = _createElementVNode("div", null, [
                    _createElementVNode("h4", null, "桌宠没有出现？"),
                    _createElementVNode("p", null, "先检查基础设置中的启用和入口替换开关，再点击右上角刷新。停用后，当前页面会在下次状态检查时恢复原生入口。")
                  ], -1))
                ]),
                _createElementVNode("div", _hoisted_16, [
                  _createVNode(_component_VBtn, {
                    variant: "tonal",
                    color: "primary",
                    "prepend-icon": "mdi-tune-variant",
                    onClick: _cache[0] || (_cache[0] = $event => (activeTab.value = 'basic'))
                  }, {
                    default: _withCtx(() => [...(_cache[23] || (_cache[23] = [
                      _createTextVNode("调整设置", -1)
                    ]))]),
                    _: 1
                  }),
                  _createVNode(_component_VBtn, {
                    variant: "text",
                    "prepend-icon": "mdi-motion-play-outline",
                    onClick: _cache[1] || (_cache[1] = $event => (activeTab.value = 'preview'))
                  }, {
                    default: _withCtx(() => [...(_cache[24] || (_cache[24] = [
                      _createTextVNode("体验动作", -1)
                    ]))]),
                    _: 1
                  })
                ])
              ], 64))
            : (activeTab.value === 'basic')
              ? (_openBlock(), _createElementBlock(_Fragment, { key: 2 }, [
                  _cache[26] || (_cache[26] = _createElementVNode("div", { class: "am-section-heading" }, [
                    _createElementVNode("div", null, [
                      _createElementVNode("h3", null, "基础设置"),
                      _createElementVNode("p", null, "修改暂存为草稿，点击底部保存后生效。")
                    ])
                  ], -1)),
                  _createVNode(_component_VCard, {
                    class: "am-setting-card",
                    variant: "outlined"
                  }, {
                    default: _withCtx(() => [
                      _createVNode(_component_VCardItem, {
                        title: "启用桌宠",
                        subtitle: "允许页面加载所选角色"
                      }, {
                        append: _withCtx(() => [
                          _createVNode(_component_VSwitch, {
                            "model-value": _unref(state).draft.enabled,
                            disabled: controlsDisabled.value,
                            color: "success",
                            density: "compact",
                            "hide-details": "",
                            inset: "",
                            "aria-label": "启用桌宠",
                            "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => (_unref(controller).edit('enabled', $event)))
                          }, null, 8, ["model-value", "disabled"])
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  }),
                  _createVNode(_component_VCard, {
                    class: "am-setting-card",
                    variant: "outlined"
                  }, {
                    default: _withCtx(() => [
                      _createVNode(_component_VCardItem, {
                        title: "替换智能助手入口",
                        subtitle: "单击桌宠打开原生智能助手"
                      }, {
                        append: _withCtx(() => [
                          _createVNode(_component_VSwitch, {
                            "model-value": _unref(state).draft.replace_agent_entry,
                            disabled: controlsDisabled.value,
                            color: "primary",
                            density: "compact",
                            "hide-details": "",
                            inset: "",
                            "aria-label": "替换智能助手入口",
                            "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => (_unref(controller).edit('replace_agent_entry', $event)))
                          }, null, 8, ["model-value", "disabled"])
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  }),
                  _createVNode(_component_VCard, {
                    class: "am-setting-card",
                    variant: "outlined"
                  }, {
                    default: _withCtx(() => [
                      _createVNode(_component_VCardItem, {
                        title: "显示侧栏入口",
                        subtitle: "在侧栏保留「Agent 桌宠」快捷入口"
                      }, {
                        append: _withCtx(() => [
                          _createVNode(_component_VSwitch, {
                            "model-value": _unref(state).draft.show_sidebar_nav,
                            disabled: controlsDisabled.value,
                            color: "primary",
                            density: "compact",
                            "hide-details": "",
                            inset: "",
                            "aria-label": "显示侧栏入口",
                            "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => (_unref(controller).edit('show_sidebar_nav', $event)))
                          }, null, 8, ["model-value", "disabled"])
                        ]),
                        _: 1
                      })
                    ]),
                    _: 1
                  }),
                  _cache[27] || (_cache[27] = _createElementVNode("p", { class: "am-hint" }, "关闭侧栏入口后，仍可从插件详情打开桌宠页面。", -1))
                ], 64))
              : (activeTab.value === 'appearance')
                ? (_openBlock(), _createElementBlock(_Fragment, { key: 3 }, [
                    _createElementVNode("div", _hoisted_17, [
                      _cache[29] || (_cache[29] = _createElementVNode("div", null, [
                        _createElementVNode("h3", null, "形象与行为"),
                        _createElementVNode("p", null, "选择角色，调整它在页面上的活动方式。")
                      ], -1)),
                      _createVNode(_component_VBtn, {
                        size: "small",
                        variant: "text",
                        "prepend-icon": "mdi-motion-play-outline",
                        onClick: _cache[5] || (_cache[5] = $event => (activeTab.value = 'preview'))
                      }, {
                        default: _withCtx(() => [...(_cache[28] || (_cache[28] = [
                          _createTextVNode("预览效果", -1)
                        ]))]),
                        _: 1
                      })
                    ]),
                    _createElementVNode("div", _hoisted_18, [
                      (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_unref(M), (option) => {
                        return (_openBlock(), _createElementBlock("button", {
                          key: option.value,
                          type: "button",
                          class: _normalizeClass(["am-character", { 'am-character--selected': _unref(state).draft.mascot === option.value }]),
                          "aria-pressed": _unref(state).draft.mascot === option.value,
                          disabled: controlsDisabled.value,
                          onClick: $event => (_unref(controller).edit('mascot', option.value))
                        }, [
                          _createElementVNode("img", {
                            src: _unref(resolveMascotProfile)(option.value).icon,
                            alt: ""
                          }, null, 8, _hoisted_20),
                          _createElementVNode("strong", null, _toDisplayString(option.value === 'kurisu' ? '克里斯蒂娜' : option.title), 1),
                          (_unref(state).draft.mascot === option.value)
                            ? (_openBlock(), _createBlock(_component_VIcon, {
                                key: 0,
                                class: "am-character-check",
                                icon: "mdi-check-circle",
                                size: "19",
                                color: "primary"
                              }))
                            : _createCommentVNode("", true)
                        ], 10, _hoisted_19))
                      }), 128))
                    ]),
                    (visible.value)
                      ? (_openBlock(), _createBlock(_sfc_main$1, {
                          key: 0,
                          api: props.api,
                          "plugin-id": props.pluginId,
                          pets: _unref(state).pets,
                          config: _unref(state).draft,
                          "saved-id": _unref(state).saved.mascot,
                          disabled: !_unref(state).ready || _unref(state).loading || _unref(state).saving || _unref(state).pendingReadback,
                          onSelect: _cache[6] || (_cache[6] = $event => (_unref(controller).edit('mascot', $event))),
                          onImported: imported,
                          onRemoved: removed,
                          onBusy: _cache[7] || (_cache[7] = $event => (libraryBusy.value = $event))
                        }, null, 8, ["api", "plugin-id", "pets", "config", "saved-id", "disabled"]))
                      : _createCommentVNode("", true),
                    _createElementVNode("div", _hoisted_21, [
                      _createElementVNode("section", _hoisted_22, [
                        _createElementVNode("label", {
                          id: `${_unref(fieldId)}-scale`
                        }, [
                          _cache[30] || (_cache[30] = _createTextVNode("角色大小 ", -1)),
                          _createElementVNode("strong", null, _toDisplayString(_unref(state).draft.scale.toFixed(2)) + "×", 1)
                        ], 8, _hoisted_23),
                        _createVNode(_component_VSlider, {
                          "model-value": _unref(state).draft.scale,
                          disabled: controlsDisabled.value,
                          min: "0.6",
                          max: "4",
                          step: "0.05",
                          "hide-details": "",
                          color: "primary",
                          "aria-labelledby": `${_unref(fieldId)}-scale`,
                          "onUpdate:modelValue": _cache[8] || (_cache[8] = $event => (_unref(controller).edit('scale', $event)))
                        }, null, 8, ["model-value", "disabled", "aria-labelledby"]),
                        _cache[31] || (_cache[31] = _createElementVNode("p", null, "0.60× — 4.00×", -1))
                      ]),
                      _createElementVNode("section", _hoisted_24, [
                        _createElementVNode("label", {
                          id: `${_unref(fieldId)}-speed`
                        }, [
                          _cache[32] || (_cache[32] = _createTextVNode("移动速度 ", -1)),
                          _createElementVNode("strong", null, _toDisplayString(_unref(state).draft.speed.toFixed(2)) + "×", 1)
                        ], 8, _hoisted_25),
                        _createVNode(_component_VSlider, {
                          "model-value": _unref(state).draft.speed,
                          disabled: controlsDisabled.value,
                          min: "0.4",
                          max: "2",
                          step: "0.05",
                          "hide-details": "",
                          color: "primary",
                          "aria-labelledby": `${_unref(fieldId)}-speed`,
                          "onUpdate:modelValue": _cache[9] || (_cache[9] = $event => (_unref(controller).edit('speed', $event)))
                        }, null, 8, ["model-value", "disabled", "aria-labelledby"]),
                        _cache[33] || (_cache[33] = _createElementVNode("p", null, "0.40× — 2.00×", -1))
                      ])
                    ]),
                    _createElementVNode("div", _hoisted_26, [
                      (_openBlock(), _createElementBlock(_Fragment, null, _renderList([{ key: 'follow_mouse', label: '跟随鼠标' }, { key: 'auto_roam', label: '自动游走' }, { key: 'shadow', label: '地面阴影' }], (item) => {
                        return _createVNode(_component_VSwitch, {
                          key: item.key,
                          "model-value": _unref(state).draft[item.key],
                          disabled: controlsDisabled.value,
                          label: item.label,
                          "hide-details": "",
                          inset: "",
                          density: "compact",
                          color: "primary",
                          "onUpdate:modelValue": $event => (_unref(controller).edit(item.key, $event))
                        }, null, 8, ["model-value", "disabled", "label", "onUpdate:modelValue"])
                      }), 64))
                    ]),
                    _cache[34] || (_cache[34] = _createElementVNode("p", { class: "am-hint" }, "手机上轻点桌宠打开助手，拖动调整位置；滑动页面不会触发跟随。页面桌宠会自动缩小以适应屏幕。", -1))
                  ], 64))
                : (activeTab.value === 'preview' && visible.value)
                  ? (_openBlock(), _createBlock(_sfc_main$2, {
                      key: 4,
                      config: previewConfig.value
                    }, null, 8, ["config"]))
                  : _createCommentVNode("", true)
      ], 2)
    ]),
    _createElementVNode("footer", _hoisted_27, [
      (discardPrompt.value)
        ? (_openBlock(), _createElementBlock(_Fragment, { key: 0 }, [
            _createElementVNode("div", _hoisted_28, _toDisplayString(_unref(state).pendingReadback ? '配置已提交但尚未确认，关闭不会撤回已提交内容。' : '关闭将放弃未保存的修改。'), 1),
            _createElementVNode("div", _hoisted_29, [
              _createVNode(_component_VBtn, {
                variant: "text",
                onClick: _cache[10] || (_cache[10] = $event => (discardPrompt.value = false))
              }, {
                default: _withCtx(() => [...(_cache[35] || (_cache[35] = [
                  _createTextVNode("继续编辑", -1)
                ]))]),
                _: 1
              }),
              _createVNode(_component_VBtn, {
                variant: "tonal",
                color: "warning",
                onClick: _cache[11] || (_cache[11] = $event => (emit('close')))
              }, {
                default: _withCtx(() => [
                  _createTextVNode(_toDisplayString(_unref(state).pendingReadback ? '仍然关闭' : '放弃并关闭'), 1)
                ]),
                _: 1
              })
            ])
          ], 64))
        : (_openBlock(), _createElementBlock(_Fragment, { key: 1 }, [
            _createElementVNode("div", {
              class: _normalizeClass(["am-feedback", { 'am-feedback--error': _unref(state).error }]),
              "aria-live": "polite"
            }, [
              _createVNode(_component_VIcon, {
                icon: _unref(state).error ? 'mdi-alert-circle-outline' : _unref(dirty) ? 'mdi-pencil-outline' : 'mdi-check-circle-outline',
                size: "18"
              }, null, 8, ["icon"]),
              _createElementVNode("span", null, _toDisplayString(feedback.value), 1)
            ], 2),
            _createElementVNode("div", _hoisted_30, [
              (_unref(dirty))
                ? (_openBlock(), _createBlock(_component_VBtn, {
                    key: 0,
                    variant: "text",
                    disabled: busy.value || _unref(state).pendingReadback,
                    onClick: _unref(controller).reset
                  }, {
                    default: _withCtx(() => [...(_cache[36] || (_cache[36] = [
                      _createTextVNode("撤销修改", -1)
                    ]))]),
                    _: 1
                  }, 8, ["disabled", "onClick"]))
                : (__props.mode !== 'app')
                  ? (_openBlock(), _createBlock(_component_VBtn, {
                      key: 1,
                      variant: "text",
                      disabled: _unref(state).saving,
                      onClick: close
                    }, {
                      default: _withCtx(() => [...(_cache[37] || (_cache[37] = [
                        _createTextVNode("关闭", -1)
                      ]))]),
                      _: 1
                    }, 8, ["disabled"]))
                  : _createCommentVNode("", true),
              (_unref(state).pendingReadback)
                ? (_openBlock(), _createBlock(_component_VBtn, {
                    key: 2,
                    variant: "flat",
                    color: "primary",
                    loading: _unref(state).loading,
                    onClick: refresh
                  }, {
                    default: _withCtx(() => [...(_cache[38] || (_cache[38] = [
                      _createTextVNode("刷新确认", -1)
                    ]))]),
                    _: 1
                  }, 8, ["loading"]))
                : (_openBlock(), _createBlock(_component_VBtn, {
                    key: 3,
                    variant: "flat",
                    color: "primary",
                    "prepend-icon": "mdi-content-save-outline",
                    loading: _unref(state).saving,
                    disabled: !_unref(dirty) || !_unref(state).ready || _unref(state).loading || libraryBusy.value,
                    onClick: _unref(controller).save
                  }, {
                    default: _withCtx(() => [...(_cache[39] || (_cache[39] = [
                      _createTextVNode("保存设置", -1)
                    ]))]),
                    _: 1
                  }, 8, ["loading", "disabled", "onClick"]))
            ])
          ], 64))
    ])
  ], 2))
}
}

};

export { _sfc_main as _, hostProps as h };
