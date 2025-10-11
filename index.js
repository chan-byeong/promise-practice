class MockPromise {
  constructor(callback) {
    this.state = "pending";
    this.value;
    this.reason;
    callback(this._resolve, this._reject);
  }

  _resolve(value, reason) {
    if (this.state !== "pending") return;
    this.value = value;
    this.reason = reason;
    this.state = "fulfilled";
  }

  _reject(value, reason) {
    if (this.state !== "pending") return;
    this.value = value;
    this.reason = reason;
    this.state = "rejected";
  }

  then(cb) {
    if (this.state === "fulfiiled") {
      // return this(cb);
      // return new MockPromise(cb); -> then의 콜백은 인자로 resolve, reject를 가지는 구조가 아니다.

      // cb의 리턴값을 다음 프로미스(새로운 promise?)의 콜백 인자로 넘겨줌
      if (typeof cb === "function") {
        this.state = cb(this.state);
      }

      return this;
    }
    return this;
  }
}

function main() {
  // step - 1
  const p = new MockPromise((resolve) => resolve(1));
  p.then((v) => v * 10)
    .then((v) => v + 10)
    .then((v) => console.log(v));
}

main();
