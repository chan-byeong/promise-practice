## 어떻게 비동기적으로 실행할 수 있을까?

`.then` 메서드를 구현할 때 `state`의 상태를 감시하고 있다가 변경이 있을 경우 콜백함수를 실행해야 한다.

보통 js에서 이런 방식으로 구현할 때 async/await를 활용하여 구현한다. 하지만 지금은 프로미스를 구현하는 과정이기에 async/await는 사용이 불가능하다.

그럼 프로미스를 사용하던가(재귀적 구조처럼) 아니면 콜백함수처럼 함수 내 함수를 실행하는 방법이 있다.

아직 프로미스의 기능이 완전하지 않아서 프로미스 클래스 내부에서 프로미스를 사용하는 건 어렵다고 생각했다.

그렇다면 함수 내 함수를 실행하는 방법이 존재한다.

`state`를 변경하는 메서드는 `_reject`, `_resolve`이므로 해당 메서드 내부에서 상태 변경을 하고,

그 뒤에 콜백함수를 실행하는 방법이 있겠다고 생각하였다.

## then은 새로운 객체 반환 + 콜백 함수는 비동기 실행

상태가 `pending`이 아닌 경우는 콜백 함수를 바로 실행하고 반환값을 받아서 새로운 프로미스를 리턴하면 되지만 `pending`인 경우 어렵다.

이를 해결하는 과정은 다음과 같다.

우선 then은 새로운 프로미스를 반환해주어야한다. 근데 인자로 들어온 콜백함수를 새로운 프로미스의 executor 함수로 등록해버리면 다음과 같은 문제가 있다.

1. 앞의 상태가 `pending`에서 바뀐 다음에 실행되어야 하는데 바로 실행되어 버린다.

2. 앞 선 프로미스의 value를 인자로 받아야 하는데 불가능하다.

3. resolve, reject 처리 또한 못한다.

그래서 빈 프로미스를 만들고 해당 프로미스를 큐에 저장해두었다가 나중에(state가 변경되었을 때) 직접 `resolve`해주는 방식으로 처리했다.

### 잘못된 구현

```javascript
 then(onFulfilled, onRejected) {
    if (this.state === "pending") {
      const executor = (state, value) => {
        let result;
        queueMicrotask(() => {
          if (state === "fulfilled") {
            result = onFulfilled(value);
          } else {
            result = onRejected(value);
          }
        });
        return result; // undefined
      };

      const promise = new MockPromise();

      this.callbackQueue.push([promise, executor]);

      return promise;
    } else {
      ...
    }
  }
```

생성한 프로미스 객체와 state가 변경되었을 때 실행해야하는 콜백함수를 `queueMicrotask`로 감싼 executor 함수를 큐에 등록하였다.

이때 문제점은 executor 함수의 반환값이 undefined가 나온다는 것이다. 왜냐하면 `queueMicrotask` 내부에서 반환값을 갱신하는데 내부 코드는 비동기적으로 실행되어서 문제가 있다.

그래서 콜백함수의 반환값을 활용하여 프로미스 resolve를 해주기 위해서는 앞서 생성한 프로미스가 `queueMicrotask` 내부에 존재해야 한다. (`queueMicrotask`는 반환값이 없어서 외부로 못 뺸다.)

이를 위해 커링함수를 활용하였다.

---

그럼 then 체이닝이 있을 때 then 뒤에 붙은 then은 반드시 앞의 promise의 상태가 pending인 경우로 시작한다.

## promise flattening

### how?

then으로 전달된 콜백함수는 `queueMicrotask`에서 실행되어야 하는데 `queueMicrotask`는 반환값이 존재하지 않음.

콜백함수가 `promise`를 반환하는 경우 `queueMicrotask` 내부에서 외부로 반환된 `promise`를 받아와서 then의 리턴값으로 넘길 수 없는 구조.

만약 콜백의 리턴값이 `promise`인 경우 `this.value`에 저장된다. 그래서 promise가 다음 콜백의 인자로 넘어간다.

그럼 flatten을 할 수 있는 경우는

**1. this.value로 promise를 받는 케이스**

2. this.value로 promise를 할당하는 케이스

1번 케이스는 pending인 경우만 처리해줘도 되지만, 2번 케이스는 2개의 경우에 대해서 처리가 필요하다.

executor 함수에서 this.value를 promise로 받는 케이스에서 flatten 해주었다.

flatten해줄 때 this.value인 promise의 value를 콜백함수가 받을 수 있도록 다시 `then`을 활용하였다. 그리고 다시 해당 프로미스의 value를 원래의 promise가 받아서 value를 업데이트하고 state도 업데이트하기 위해서 또 다시 `then`을 활용하였다.

```javascript
if (arg instanceof MockPromise) {
  arg
    .then(onFulfilled, onRejected)
    .then(promise._resolve.bind(promise), promise._reject.bind(promise));
} else {
  promise._resolve(onFulfilled(arg));
}
```

이때 `step2` 함수 결과가 출력되지 않았는데 AI에게 물어봐서 `promise._resolve`의 this 바인딩 문제임을 알 수 있었다.

## JS에서 static method
