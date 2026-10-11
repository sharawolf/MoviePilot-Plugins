import { importShared } from './__federation_fn_import-JrT3xvdd.js';
import { h as hostProps, _ as _sfc_main$1 } from './PluginWorkspace-DuFsK5xo.js';

const {mergeProps:_mergeProps,openBlock:_openBlock,createBlock:_createBlock} = await importShared('vue');

const _sfc_main = {
  __name: 'Config',
  props: hostProps,
  emits: ['close', 'layout'],
  setup(__props) {




return (_ctx, _cache) => {
  return (_openBlock(), _createBlock(_sfc_main$1, _mergeProps({ key: _ctx.pluginId }, _ctx.$props, {
    mode: "config",
    onClose: _cache[0] || (_cache[0] = $event => (_ctx.$emit('close'))),
    onLayout: _cache[1] || (_cache[1] = $event => (_ctx.$emit('layout', $event)))
  }), null, 16))
}
}

};

export { _sfc_main as default };
