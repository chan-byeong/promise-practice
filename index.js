class MockPromise {
  constructor(executor) {
    this.state = "pending";
    this.value;
    this.reason;
    this.callbackQueue = [];

    try {
      executor(this._resolve.bind(this), this._reject.bind(this));
    } catch (error) {
      this._reject(error);
    }
  }

  static resolve(value) {
    return new this((res) => res(value));
  }

  static reject(value) {
    return new this((_, rej) => rej(value));
  }

  _resolve(value) {
    if (this.state !== "pending") return;
    this.value = value;
    this.state = "fulfilled";
    // queue 작업 실행
    this._onStateChange();
  }

  _reject(reason) {
    if (this.state !== "pending") return;
    this.reason = reason;
    this.state = "rejected";

    //
    this._onStateChange();
  }

  _onStateChange() {
    const cb = this.callbackQueue.shift();
    if (cb) {
      cb(this.state, this.value ?? this.reason);
    }
  }

  then(onFulfilled, onRejected) {
    if (this.state === "pending") {
      const promise = new MockPromise(() => {});

      const executor = (promise) => (state, arg) => {
        // value === arg가 promise인 경우
        queueMicrotask(() => {
          try {
            if (state === "fulfilled") {
              if (arg instanceof MockPromise) {
                arg
                  .then(onFulfilled, onRejected)
                  .then(
                    promise._resolve.bind(promise),
                    promise._reject.bind(promise)
                  );
              } else {
                promise._resolve(onFulfilled(arg));
              }
            } else {
              promise._resolve(onRejected(arg));
            }
          } catch (error) {
            promise._reject(error);
          }
        });
      };

      this.callbackQueue.push(executor(promise));

      return promise;
    } else {
      return new MockPromise((resolve, reject) => {
        queueMicrotask(() => {
          try {
            const result =
              this.state === "fulfilled"
                ? onFulfilled(this.value)
                : onRejected(this.reason);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });
    }
  }
}

function main() {
  // step - 1
  function step1() {
    const p = new MockPromise((resolve) => resolve(1));
    p.then((v) => v * 10)
      .then((v) => v + 10)
      .then((v) => console.log(v)); // 20
  }

  // step - 2
  function step2() {
    function later(v, t = 50) {
      return new MockPromise((res) => setTimeout(() => res(v), t));
    } // later: 50ms 뒤 fulfilled되는 프로미스 반환.

    new MockPromise((res) => res(1))
      .then((v) => later(v * 2)) // MockPromise { value = 1 }
      .then((v) => later(v + 3)) // MockPromise { value = MockPromise }
      .then((v) => console.log(v));
  }

  function step3() {
    console.log("start");
    setTimeout(() => console.log("macro task"), 0);
    MockPromise.resolve().then(() => console.log("micro task - 1"));
    new MockPromise((res) => res()).then(() => console.log("micro task - 2"));
    console.log("end");
  }
  step3();
}

main();
