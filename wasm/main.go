package main

//export add
func add(x int, y int) int {
	return x + y
}

//export fib
func fib(x int) int {
	if x <= 1 {
		return 1
	}
	return fib(x-1) + fib(x-2)
}

func main() {}
