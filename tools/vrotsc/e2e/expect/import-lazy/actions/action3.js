/**
 * @return {Any}
 */
(function () {
    var __global = System.getContext() || (function () {
        return this;
    }).call(null);
    var VROES = __global.__VROES || (__global.__VROES = System.getModule("com.vmware.pscoe.library.ecmascript").VROES()), exports = {};
    var action1 = VROES.importLazy("com.vmware.pscoe.vrotsc.action1");
    function action3(str) {
    }
    exports.action3 = action3;
    exports.default = action1._;
    return exports;
});
