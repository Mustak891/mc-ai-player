# cmake-rules-override.cmake
# This file is loaded as CMAKE_USER_MAKE_RULES_OVERRIDE which runs early
# in CMake configuration, before build rules are set.
# Purpose: Remove -Wa,-mbig-obj from all build type flags.
# This flag is an MSVC/MinGW-only assembler option that CMake injects on
# Windows for RelWithDebInfo builds. It is incompatible with the Android
# NDK's clang++ cross-compiler and causes build failures.

foreach(flag_var
    CMAKE_CXX_FLAGS
    CMAKE_CXX_FLAGS_DEBUG
    CMAKE_CXX_FLAGS_RELEASE
    CMAKE_CXX_FLAGS_RELWITHDEBINFO
    CMAKE_CXX_FLAGS_MINSIZEREL
    CMAKE_C_FLAGS
    CMAKE_C_FLAGS_DEBUG
    CMAKE_C_FLAGS_RELEASE
    CMAKE_C_FLAGS_RELWITHDEBINFO
    CMAKE_C_FLAGS_MINSIZEREL)
  if(DEFINED ${flag_var})
    string(REPLACE "-Wa,-mbig-obj" "" ${flag_var} "${${flag_var}}")
    set(${flag_var} "${${flag_var}}" CACHE STRING "" FORCE)
  endif()
endforeach()
