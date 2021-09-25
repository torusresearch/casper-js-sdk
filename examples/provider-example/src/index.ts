import {
  CasperClient,
  CasperServiceByJsonRPC,
  CasperServiceByProvider,
  DeployUtil,
  encodeBase16,
  Keys,
  decodeBase16,
  CLPublicKey
} from 'casper-js-sdk';
import {
  JRPCRequest,
  SendCallBack,
  SafeEventEmitterProvider
} from 'casper-js-sdk/dist/services/ProviderTransport';
// import fetch from 'node-fetch';

import { ethErrors } from 'eth-rpc-errors';
import { Err } from 'ts-results';

const TEST_ACCOUNT = {
  key: '49546db2f9c7c13358887deff74ef4ec10f66b0319e1ef239e940aafe51262aa',
  pubKeyHex: encodeBase16(
    Keys.Secp256K1.privateToPublicKey(
      decodeBase16(
        '49546db2f9c7c13358887deff74ef4ec10f66b0319e1ef239e940aafe51262aa'
      )
    )
  )
};
const TEST_PUB_KEY = Keys.Secp256K1.privateToPublicKey(
  decodeBase16(
    '49546db2f9c7c13358887deff74ef4ec10f66b0319e1ef239e940aafe51262aa'
  )
);

const keyPair = new Keys.Secp256K1(
  TEST_PUB_KEY,
  Buffer.from(TEST_ACCOUNT.key, 'hex')
);

const caspertTestnet = 'https://testnet.casper-node.tor.us';
const RETRIABLE_ERRORS: string[] = [
  // ignore server overload errors
  'Gateway timeout',
  'ETIMEDOUT',
  // ignore server sent html error pages
  // or truncated json responses
  'failed to parse response body',
  // ignore errors where http req failed to establish
  'Failed to fetch'
];

function checkForHttpErrors(fetchRes: any): void {
  // check for errors
  switch (fetchRes.status) {
    case 405:
      throw ethErrors.rpc.methodNotFound();

    case 418:
      throw ethErrors.rpc.internal({
        message: `Request is being rate limited.`
      });

    case 503:
    case 504:
      throw ethErrors.rpc.internal({
        message:
          `Gateway timeout. The request took too long to process.` +
          `This can happen when querying over too wide a block range.`
      });

    default:
      break;
  }
}

function timeout(duration: number): Promise<number> {
  return new Promise(resolve => setTimeout(resolve, duration));
}

function parseResponse(fetchRes: any, body: Record<string, unknown>): any {
  // check for error code
  if (fetchRes.status !== 200) {
    throw ethErrors.rpc.internal({
      message: `Non-200 status code: '${fetchRes.status}'`,
      data: body
    });
  }
  // check for rpc error
  if (body.error) {
    throw ethErrors.rpc.internal({
      data: body.error
    });
  }
  // return successful result
  return body.result;
}

const createFetchConfigFromReq = ({
  req,
  rpcTarget
}: {
  req: JRPCRequest<unknown>;
  rpcTarget: string;
}) => {
  const parsedUrl: URL = new URL(rpcTarget);

  // prepare payload
  // copy only canonical json rpc properties
  const payload = {
    id: req.id,
    jsonrpc: req.jsonrpc,
    method: req.method,
    params: req.params
  };
  // serialize request body
  const serializedPayload: string = JSON.stringify(payload);

  // configure fetch params
  const fetchParams = {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: serializedPayload
  };

  return { fetchUrl: parsedUrl.href, fetchParams };
};
const sendRpcRequestToChain = async (req: JRPCRequest<unknown>) => {
  const rpcTarget = caspertTestnet;
  const { fetchUrl, fetchParams } = createFetchConfigFromReq({
    req,
    rpcTarget
  });

  // attempt request multiple times
  const maxAttempts = 5;
  const retryInterval = 1000;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const fetchRes = await fetch(fetchUrl, fetchParams);
      // check for http errrors
      checkForHttpErrors(fetchRes);
      // parse response body
      const fetchBody = await fetchRes.json();
      const result = parseResponse(
        fetchRes,
        fetchBody as Record<string, unknown>
      );
      // set result and exit retry loop
      return result;
    } catch (err) {
      const errMsg: string = err.toString();
      const isRetriable: boolean = RETRIABLE_ERRORS.some(phrase =>
        errMsg.includes(phrase)
      );
      // re-throw error if not retriable
      if (!isRetriable) {
        throw err;
      }
    }
    // delay before retrying
    await timeout(retryInterval);
  }
};

const client = new CasperClient(caspertTestnet);

const processDeploy = async (req: JRPCRequest<unknown>) => {
  try {
    // we can do any preprocessing or validation on deploy here,
    // and then finally sign deploy and send it blockchain.
    const deserializedDeploy = DeployUtil.deployFromJson(req.params as any);
    if (deserializedDeploy.ok) {
      const signedDeploy = client.signDeploy(deserializedDeploy.val, keyPair);
      req.params = DeployUtil.deployToJson(signedDeploy);
      const jrpcResult = await sendRpcRequestToChain(req);
      return {
        id: req.id,
        jsonrpc: req.jsonrpc,
        result: jrpcResult,
        error: null
      };
    }
    throw new Error('Failed to parsed deploy');
  } catch (error) {
    throw error;
  }
};

const provider: SafeEventEmitterProvider = {
  sendAsync: async (req: JRPCRequest<unknown>): Promise<any> => {
    // we are intercepting 'chain_get_block' and returning custom result,
    // for rest of rpc calls we are simply sending rpc call to blockchain and returning the result.
    if (req.method === 'account_put_deploy') {
      return processDeploy(req);
    } else {
      try {
        const jrpcResult = await sendRpcRequestToChain(req);
        return {
          id: req.id,
          jsonrpc: req.jsonrpc,
          result: jrpcResult,
          error: null
        };
      } catch (error) {
        return {
          id: req.id,
          jsonrpc: req.jsonrpc,
          result: null,
          error
        };
      }
    }
  },
  // currently we only use sendAsync in provider transport, so we live it unimplemented here.
  send: (req: JRPCRequest<unknown>, callback: SendCallBack<any>): void => {
    return;
  }
};
const cs = new CasperServiceByProvider(provider);

const sendDeployWithProvider = async () => {
  // note that,  rpc method name for this is 'account_put_deploy' which we are intercepting in sendAsync function
  // inside provider,
  // so request will go to chain using after getting processes inside sendAsync.
  const receiverClPubKey = CLPublicKey.fromHex(
    new CLPublicKey(
      decodeBase16(TEST_ACCOUNT.pubKeyHex),
      Keys.SignatureAlgorithm.Secp256K1
    ).toHex()
  );

  // keeping sender key same as receiver for testing.
  const senderCLPubKey = CLPublicKey.fromHex(
    new CLPublicKey(
      decodeBase16(TEST_ACCOUNT.pubKeyHex),
      Keys.SignatureAlgorithm.Secp256K1
    ).toHex()
  );
  // making a unsigned deploy
  const deploy = DeployUtil.makeDeploy(
    new DeployUtil.DeployParams(senderCLPubKey, 'casper-test', 1),
    DeployUtil.ExecutableDeployItem.newTransfer(
      2500000000,
      receiverClPubKey, // receiver CLPubKey
      null, // we will use main purse, so it can be left null
      '1' // keep static for testing
    ),
    DeployUtil.standardPayment(100000)
  );
  try {
    // sending a unsigned deploy, it will be signed by provider and then sent.
    const deployRes = await cs.deploy(deploy);
    console.log('deploy res', deployRes);
  } catch (error) {
    console.log('invalid deploy', error);
  }
};

(async () => {
  console.log('using provider');
  await sendDeployWithProvider();
})();
