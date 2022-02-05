import React from "react";

const singleWorker: Worker = new Worker(new URL("worker.ts", import.meta.url), {
  type: "module",
});

type Task = {
  config: string;
  cb: (value: any) => void;
};

class WorkerPool {
  _workers: Worker[];
  _avail: boolean[];
  _queue: Task[];

  constructor(count: number) {
    this._workers = [];
    this._avail = [];
    this._queue = [];
    for (let i = 0; i < count; i++) {
      this._workers.push(
        new Worker(new URL("worker.ts", import.meta.url), {
          type: "module",
        })
      );
      this._avail.push(true);
    }
    console.log("worker pool ready: ", this);
  }

  queue(t: Task) {
    //add it to queue
    this._queue.push(t);
    //try popping
    this.pop();
  }

  private pop() {
    // console.log("looking for worker to do work: ", this);
    if (this._queue.length == 0) {
      return;
    }
    //find free worker
    let ind = -1;
    for (let i = 0; i < this._avail.length; i++) {
      if (this._avail[i]) {
        ind = i;
        break;
      }
    }

    if (ind === -1) {
      return;
    }

    //pop from slice
    const task = this._queue[0];
    this._queue = this._queue.slice(1, this._queue.length);
    this.run(ind, task);
  }

  //ask current worker to run a task
  private run(workerIndex: number, task: Task) {
    this._avail[workerIndex] = false;
    let w = this._workers[workerIndex];
    w.postMessage(task.config);
    w.onmessage = (ev) => {
      task.cb(ev.data);
      this._avail[workerIndex] = true;
      // console.log("worker done: ", this);
      //try popping maybe there's more
      this.pop();
    };
  }
}

const max = 1000;
const workerCount = 15;
const pool = new WorkerPool(workerCount);

export function App() {
  // const [count, setCount] = React.useState(0);
  const runThreaded = () => {
    console.log("start running threaded");
    let queued = 0;
    let done = 0;
    console.time("fib-run");
    const cbFunc = (val: any) => {
      console.log(
        "finish a run, result: " + val,
        "done",
        done,
        "queue",
        queued
      );

      done++;
      if (done == max) {
        //done now
        console.log("done running");
        console.timeEnd("fib-run");
        return;
      }

      //otherwise check if we need to queue more
      if (queued < max) {
        //queue another worker
        queued++;
        pool.queue({ config: "", cb: cbFunc });
      }
      //otherwise do nothing
    };
    //queue up 10 to start
    for (; queued < workerCount + 5; queued++) {
      pool.queue({ config: "", cb: cbFunc });
    }
  };
  const runSingle = () => {
    let iter = 0;
    console.time("fib-run");
    singleWorker.onmessage = (ev) => {
      iter++;
      if (iter < max) {
        singleWorker.postMessage("run");
        // console.log("finish run number " + iter + ", result: " + ev.data);
        // setCount(iter);
      } else {
        //done now
        console.log("done running");
        console.timeEnd("fib-run");
      }
    };
    singleWorker.postMessage("run");
  };
  return (
    <div>
      <h1>Run</h1>
      <br />
      <button onClick={runSingle}>single</button>
      <br />
      <button onClick={runThreaded}>threaded</button>
    </div>
  );
}
