; ModuleID = 'test_mine.slua'
source_filename = "test_mine.slua"

declare ptr @slua_alloc(i64)

declare void @slua_free(ptr)

declare void @slua_panic(ptr, ptr, i32)

declare void @slua_print_str(ptr)

declare void @slua_print_int(i64)

declare void @slua_print_float(double)

declare void @slua_print_bool(i32)

declare void @slua_print_null()

declare i64 @slua_time_ns()

declare void @slua_exit(i32)

define i64 @add(i64 %a, i64 %b) {
entry:
  %b2 = alloca i64, align 8
  %a1 = alloca i64, align 8
  %retval = alloca i64, align 8
  store i64 0, ptr %retval, align 4
  store i64 %a, ptr %a1, align 4
  store i64 %b, ptr %b2, align 4
  %a3 = load i64, ptr %a1, align 4
  %b4 = load i64, ptr %b2, align 4
  %0 = add i64 %a3, %b4
  store i64 %0, ptr %retval, align 4
  br label %exit

exit:                                             ; preds = %entry
  %1 = load i64, ptr %retval, align 4
  ret i64 %1
}

define i64 @main() {
entry:
  %result = alloca i64, align 8
  %retval = alloca i64, align 8
  store i64 0, ptr %retval, align 4
  %0 = call i64 @add(i64 10, i64 20)
  store i64 %0, ptr %result, align 4
  %result1 = load i64, ptr %result, align 4
  call void @slua_print_int(i64 %result1)
  %result2 = load i64, ptr %result, align 4
  store i64 %result2, ptr %retval, align 4
  br label %exit

exit:                                             ; preds = %entry
  %1 = load i64, ptr %retval, align 4
  ret i64 %1
}
