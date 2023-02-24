import chai, { expect } from 'chai';
import chaiAsPromise from 'chai-as-promised';

import { EventName, EventStream } from './EventStream';

chai.use(chaiAsPromise);

const sleep = (ms: number) => {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
};

describe('EventStream', () => {
  const startEventStream = async (url: string) => {
    const es = new EventStream(url);
    es.start();
    let blockAddedEvent;
    es.subscribe(EventName.BlockAdded, res => (blockAddedEvent = res));

    while (true) {
      if (blockAddedEvent) break;
      await sleep(300);
    }

    expect(blockAddedEvent)
      .to.be.have.nested.property('body.BlockAdded.block_hash')
      .and.to.be.a('string');
    es.stop();
  };
  xit('should work on http', async () => {
    await startEventStream('http://176.9.63.35:9999/events/main');

    try {
      await startEventStream(
        'https://events.mainnet.casperlabs.io/events/main'
      );
    } catch (error) {
      console.log(error);
      expect(error).to.be.an('Error');
    }
  });

  it('should throw error for https protocol', async () => {
    await expect(
      startEventStream('https://events.mainnet.casperlabs.io/events/main')
    ).to.be.rejectedWith('EventStream: Unsupported protocol');
  });
});
