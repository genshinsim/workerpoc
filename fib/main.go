package main

import (
	"log"
	"time"
)

//export fib
func fib(x int) int {
	if x <= 1 {
		return 1
	}
	return fib(x-1) + fib(x-2)
}

func main() {
	//run fib code 1000 times
	start := time.Now()
	for i := 0; i < 1000; i++ {
		fib(30)
	}
	log.Println(time.Since(start))

}
