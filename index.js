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
      const promise = new MockPromise(() => console.log("mock promise"));

      const executor = (promise) => (state, arg) => {
        queueMicrotask(() => {
          try {
            if (state === "fulfilled") {
              promise._resolve(onFulfilled(arg));
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
  console.log("step - 1");
  const p = new MockPromise((resolve) => resolve(1));
  p.then((v) => v * 10)
    .then((v) => v + 10)
    .then((v) => console.log(v)); // 20

  console.log("step - 2");

  // step - 2
  function later(v, t = 50) {
    return new MockPromise((res) => setTimeout(() => res(v), t));
  } // later: 50ms 뒤 fulfilled되는 프로미스 반환.

  new MockPromise((res) => res(1))
    .then((v) => later(v * 2))
    .then((v) => later(v + 3)) // flattening -> promise 속성을 자세히 모르는 듯.
    .then((v) => console.log(v));
}

main();
