import { importShared } from './__federation_fn_import-JrT3xvdd.js';
import './runtime-BCybTabx.js?v=d9a72ff120dfcb19';
import './mascot-runtime.js?v=d9a72ff120dfcb19';
import { startAgentMascotStage } from './agentmascot-loader.js?v=d9a72ff120dfcb19';
import './provider-mBbtEwEX.js?v=d9a72ff120dfcb19';

const {openBlock:_openBlock,createElementBlock:_createElementBlock,createCommentVNode:_createCommentVNode} = await importShared('vue');


const {computed,onBeforeUnmount,onMounted,ref,shallowRef} = await importShared('vue');


const _sfc_main = {
  __name: 'AgentPet',
  props: {
  agent: { type: Object, required: true },
  pet: { type: Object, required: true },
  api: { type: Object, required: true },
  pluginId: { type: String, required: true },
},
  setup(__props) {

const props = __props;
const container = ref(null);
const failure = shallowRef(null);
let handle;
// Forward asynchronous config/image failures through Vue to the host's fallback.
const healthy = computed(() => {
  if (failure.value) throw failure.value
  return true
});
onMounted(() => {
  handle = startAgentMascotStage(container.value, {
    api: props.api, pluginId: props.pluginId, agent: props.agent, pet: props.pet,
    onError: error => { failure.value = error; },
  });
});
onBeforeUnmount(() => handle?.stop());

return (_ctx, _cache) => {
  return (healthy.value)
    ? (_openBlock(), _createElementBlock("div", {
        key: 0,
        ref_key: "container",
        ref: container,
        class: "agentmascot-stage",
        style: {"position":"fixed","inset":"0","pointer-events":"none"}
      }, null, 512))
    : _createCommentVNode("", true)
}
}

};

export { _sfc_main as default };
