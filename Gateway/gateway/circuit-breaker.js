const circuitBreaker = {
  userService: {
    failures: 0,
    open: false,
    lastFailureTime: 0
  },
  orderService: {
    failures: 0,
    open: false,
    lastFailureTime: 0
  }
};
module.exports=circuitBreaker;