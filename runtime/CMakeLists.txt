file(GLOB RUNTIME_SOURCES src/*.c)

add_library(libslua STATIC
    ${RUNTIME_SOURCES}
    ${CMAKE_CURRENT_SOURCE_DIR}/../stdlib/slua_stdlib.c)

target_include_directories(libslua PUBLIC include)
set_target_properties(libslua PROPERTIES OUTPUT_NAME slua)

find_package(raylib CONFIG QUIET)
if(raylib_FOUND)
    message(STATUS "raylib found")
    target_sources(libslua PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/../stdlib/slua_raylib.c)
    target_link_libraries(libslua PUBLIC raylib)
    target_compile_definitions(libslua PUBLIC SLUA_HAS_RAYLIB=1)
else()
    message(STATUS "raylib not found - GUI disabled")
endif()

install(TARGETS libslua DESTINATION lib)
install(DIRECTORY include/ DESTINATION include/slua)
