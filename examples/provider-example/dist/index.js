'use strict';
var __awaiter =
  (this && this.__awaiter) ||
  function(thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function(resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __generator =
  (this && this.__generator) ||
  function(thisArg, body) {
    var _ = {
        label: 0,
        sent: function() {
          if (t[0] & 1) throw t[1];
          return t[1];
        },
        trys: [],
        ops: []
      },
      f,
      y,
      t,
      g;
    return (
      (g = { next: verb(0), throw: verb(1), return: verb(2) }),
      typeof Symbol === 'function' &&
        (g[Symbol.iterator] = function() {
          return this;
        }),
      g
    );
    function verb(n) {
      return function(v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError('Generator is already executing.');
      while (_)
        try {
          if (
            ((f = 1),
            y &&
              (t =
                op[0] & 2
                  ? y['return']
                  : op[0]
                  ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                  : y.next) &&
              !(t = t.call(y, op[1])).done)
          )
            return t;
          if (((y = 0), t)) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (
                !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                (op[0] === 6 || op[0] === 2)
              ) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  };
Object.defineProperty(exports, '__esModule', { value: true });
var casper_js_sdk_1 = require('casper-js-sdk');
// import fetch from 'node-fetch';
var eth_rpc_errors_1 = require('eth-rpc-errors');
var caspertTestnet = 'https://testnet.casper-node.tor.us';
var RETRIABLE_ERRORS = [
  // ignore server overload errors
  'Gateway timeout',
  'ETIMEDOUT',
  // ignore server sent html error pages
  // or truncated json responses
  'failed to parse response body',
  // ignore errors where http req failed to establish
  'Failed to fetch'
];
function checkForHttpErrors(fetchRes) {
  // check for errors
  switch (fetchRes.status) {
    case 405:
      throw eth_rpc_errors_1.ethErrors.rpc.methodNotFound();
    case 418:
      throw eth_rpc_errors_1.ethErrors.rpc.internal({
        message: 'Request is being rate limited.'
      });
    case 503:
    case 504:
      throw eth_rpc_errors_1.ethErrors.rpc.internal({
        message:
          'Gateway timeout. The request took too long to process.' +
          'This can happen when querying over too wide a block range.'
      });
    default:
      break;
  }
}
function timeout(duration) {
  return new Promise(function(resolve) {
    return setTimeout(resolve, duration);
  });
}
function parseResponse(fetchRes, body) {
  // check for error code
  if (fetchRes.status !== 200) {
    throw eth_rpc_errors_1.ethErrors.rpc.internal({
      message: "Non-200 status code: '" + fetchRes.status + "'",
      data: body
    });
  }
  // check for rpc error
  if (body.error) {
    throw eth_rpc_errors_1.ethErrors.rpc.internal({
      data: body.error
    });
  }
  // return successful result
  return body.result;
}
var createFetchConfigFromReq = function(_a) {
  var req = _a.req,
    rpcTarget = _a.rpcTarget;
  var parsedUrl = new URL(rpcTarget);
  // prepare payload
  // copy only canonical json rpc properties
  var payload = {
    id: req.id,
    jsonrpc: req.jsonrpc,
    method: req.method,
    params: req.params
  };
  // serialize request body
  var serializedPayload = JSON.stringify(payload);
  // configure fetch params
  var fetchParams = {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: serializedPayload
  };
  return { fetchUrl: parsedUrl.href, fetchParams: fetchParams };
};
var sendRpcRequestToChain = function(req) {
  return __awaiter(void 0, void 0, void 0, function() {
    var rpcTarget,
      _a,
      fetchUrl,
      fetchParams,
      maxAttempts,
      retryInterval,
      _loop_1,
      attempt,
      state_1;
    return __generator(this, function(_b) {
      switch (_b.label) {
        case 0:
          rpcTarget = caspertTestnet;
          (_a = createFetchConfigFromReq({
            req: req,
            rpcTarget: rpcTarget
          })),
            (fetchUrl = _a.fetchUrl),
            (fetchParams = _a.fetchParams);
          maxAttempts = 5;
          retryInterval = 1000;
          _loop_1 = function(attempt) {
            var fetchRes, fetchBody, result, err_1, errMsg_1, isRetriable;
            return __generator(this, function(_a) {
              switch (_a.label) {
                case 0:
                  _a.trys.push([0, 3, , 4]);
                  return [4 /*yield*/, fetch(fetchUrl, fetchParams)];
                case 1:
                  fetchRes = _a.sent();
                  // check for http errrors
                  checkForHttpErrors(fetchRes);
                  return [4 /*yield*/, fetchRes.json()];
                case 2:
                  fetchBody = _a.sent();
                  result = parseResponse(fetchRes, fetchBody);
                  return [2 /*return*/, { value: result }];
                case 3:
                  err_1 = _a.sent();
                  errMsg_1 = err_1.toString();
                  isRetriable = RETRIABLE_ERRORS.some(function(phrase) {
                    return errMsg_1.includes(phrase);
                  });
                  // re-throw error if not retriable
                  if (!isRetriable) {
                    throw err_1;
                  }
                  return [3 /*break*/, 4];
                case 4:
                  // delay before retrying
                  return [4 /*yield*/, timeout(retryInterval)];
                case 5:
                  // delay before retrying
                  _a.sent();
                  return [2 /*return*/];
              }
            });
          };
          attempt = 0;
          _b.label = 1;
        case 1:
          if (!(attempt < maxAttempts)) return [3 /*break*/, 4];
          return [5 /*yield**/, _loop_1(attempt)];
        case 2:
          state_1 = _b.sent();
          if (typeof state_1 === 'object') return [2 /*return*/, state_1.value];
          _b.label = 3;
        case 3:
          attempt++;
          return [3 /*break*/, 1];
        case 4:
          return [2 /*return*/];
      }
    });
  });
};
var processDeploy = function(req) {
  return __awaiter(void 0, void 0, void 0, function() {
    var jrpcResult, error_1;
    return __generator(this, function(_a) {
      switch (_a.label) {
        case 0:
          _a.trys.push([0, 2, , 3]);
          return [4 /*yield*/, sendRpcRequestToChain(req)];
        case 1:
          jrpcResult = _a.sent();
          return [
            2 /*return*/,
            {
              id: req.id,
              jsonrpc: req.jsonrpc,
              result: jrpcResult,
              error: null
            }
          ];
        case 2:
          error_1 = _a.sent();
          console.log('error in provider', error_1);
          return [
            2 /*return*/,
            {
              id: req.id,
              jsonrpc: req.jsonrpc,
              result: null,
              error: error_1
            }
          ];
        case 3:
          return [2 /*return*/];
      }
    });
  });
};
var provider = {
  sendAsync: function(req) {
    return __awaiter(void 0, void 0, void 0, function() {
      var jrpcResult, error_2;
      return __generator(this, function(_a) {
        switch (_a.label) {
          case 0:
            if (!(req.method === 'chain_get_block')) return [3 /*break*/, 1];
            return [
              2 /*return*/,
              {
                id: req.id,
                jsonrpc: req.jsonrpc,
                result: {},
                error: null
              }
            ];
          case 1:
            if (!(req.method === 'account_put_deploy')) return [3 /*break*/, 2];
            return [2 /*return*/, processDeploy(req)];
          case 2:
            _a.trys.push([2, 4, , 5]);
            return [4 /*yield*/, sendRpcRequestToChain(req)];
          case 3:
            jrpcResult = _a.sent();
            console.log('jrpcResult', jrpcResult);
            return [
              2 /*return*/,
              {
                id: req.id,
                jsonrpc: req.jsonrpc,
                result: jrpcResult,
                error: null
              }
            ];
          case 4:
            error_2 = _a.sent();
            console.log('error in provider', error_2);
            return [
              2 /*return*/,
              {
                id: req.id,
                jsonrpc: req.jsonrpc,
                result: null,
                error: error_2
              }
            ];
          case 5:
            return [2 /*return*/];
        }
      });
    });
  },
  // currently we only use sendAsync in provider transport, so we live it unimplemented here.
  send: function(req, callback) {
    return;
  }
};
var cs = new casper_js_sdk_1.CasperServiceByProvider(provider);
var cj = new casper_js_sdk_1.CasperServiceByJsonRPC(caspertTestnet);
var sendDeployWithProvider = function() {
  return __awaiter(void 0, void 0, void 0, function() {
    var eraInfo, latestBlock;
    return __generator(this, function(_a) {
      switch (_a.label) {
        case 0:
          return [
            4 /*yield*/,
            cs.getEraInfoBySwitchBlock(
              '77e5cc0682c1335fd3d41670e7635c9314fb48bc5eef685f40deb534b2f88a5b'
            )
          ];
        case 1:
          eraInfo = _a.sent();
          console.log('res from provider request to chain', eraInfo);
          return [4 /*yield*/, cs.getLatestBlockInfo()];
        case 2:
          latestBlock = _a.sent();
          console.log('res from rpc', latestBlock);
          return [2 /*return*/];
      }
    });
  });
};
(function() {
  return __awaiter(void 0, void 0, void 0, function() {
    return __generator(this, function(_a) {
      switch (_a.label) {
        case 0:
          console.log('using provider');
          return [4 /*yield*/, sendDeployWithProvider()];
        case 1:
          _a.sent();
          return [2 /*return*/];
      }
    });
  });
})();
//# sourceMappingURL=index.js.map
