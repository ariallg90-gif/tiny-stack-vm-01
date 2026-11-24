// Tiny stack VM (ISA v1): one run answers a 40-instance set, i001..i040.
// node main.ts — reads MAKEFUN_INPUT_DIR (/input), writes MAKEFUN_OUTPUT_DIR (/output).
// Per instance it reads program.bin + input.bin and writes stdout.bin (the exact
// bytes the program wrote) and exit.txt (its exit code, 0-255, with a newline).
import * as fs from "node:fs";
import * as path from "node:path";

const IN_DIR = process.env.MAKEFUN_INPUT_DIR ?? "/input";
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const MAX_STEPS = 1_000_000, MAX_STACK = 256, MAX_CALLS = 64, MAX_OUT = 65_536;

// Traps end the run at once; the thrown number is the exit code.
// bin pops b (top) then a and pushes f(a, b); un pops one and pushes f(a).
function bin(st: number[], f: (a: number, b: number) => number): void {
  if (st.length < 2) throw 2;
  const b = st.pop()!, a = st.pop()!;
  st.push(f(a, b));
}
function un(st: number[], f: (a: number) => number): void {
  if (st.length < 1) throw 2;
  st.push(f(st.pop()!));
}
// Little-endian immediates at byte offset `at` of the program.
function i16(p: Buffer, at: number): number { return ((p[at] | (p[at + 1] << 8)) << 16) >> 16; }
function u16(p: Buffer, at: number): number { return p[at] | (p[at + 1] << 8); }

function run(prog: Buffer, input: Buffer): { exit: number; out: Buffer } {
  const st: number[] = [], cs: number[] = [], mem = new Int32Array(256), out: number[] = [];
  let pc = 0, ip = 0, steps = 0;
  try {
    for (;;) {
      if (steps >= MAX_STEPS) throw 10;
      if (pc < 0 || pc >= prog.length) throw 9;
      const op = prog[pc];
      const imm = op === 1 ? 1 : op === 2 ? 4 : op >= 0x30 && op <= 0x33 ? 2 : 0;
      if (pc + 1 + imm > prog.length) throw 9;
      steps++;
      const next = pc + 1 + imm;

      switch (op) {
        case 0x00: // HALT
          return { exit: 0, out: Buffer.from(out) };
        case 0x01: // PUSH8, sign-extended
          if (st.length >= MAX_STACK) throw 3;
          st.push((prog[pc + 1] << 24) >> 24);
          break;
        case 0x02: // PUSH32, little-endian
          if (st.length >= MAX_STACK) throw 3;
          st.push(prog[pc + 1] | (prog[pc + 2] << 8) | (prog[pc + 3] << 16) | (prog[pc + 4] << 24));
          break;
        case 0x03: // POP
          if (st.length < 1) throw 2;
          st.pop();
          break;
        case 0x04: // DUP
          if (st.length < 1) throw 2;
          if (st.length >= MAX_STACK) throw 3;
          st.push(st[st.length - 1]);
          break;
        case 0x05: // SWAP
          if (st.length < 2) throw 2;
          { const t = st[st.length - 1]; st[st.length - 1] = st[st.length - 2]; st[st.length - 2] = t; }
          break;
        case 0x06: // OVER
          if (st.length < 2) throw 2;
          if (st.length >= MAX_STACK) throw 3;
          st.push(st[st.length - 2]);
          break;
        case 0x07: // ROT (a b c -- b c a)
          if (st.length < 3) throw 2;
          { const a = st[st.length - 3]; st[st.length - 3] = st[st.length - 2]; st[st.length - 2] = st[st.length - 1]; st[st.length - 1] = a; }
          break;
        case 0x10: bin(st, (a, b) => (a + b) | 0); break; // ADD, wraps
        case 0x11: bin(st, (a, b) => (a - b) | 0); break; // SUB, wraps
        case 0x12: bin(st, Math.imul); break; // MUL, low 32 bits of the exact product
        case 0x13: // DIV, signed, truncates toward zero; -2^31 / -1 wraps to -2^31
          bin(st, (a, b) => { if (b === 0) throw 4; return (a / b) | 0; });
          break;
        case 0x14: // MOD, sign follows a; x % -1 is 0
          bin(st, (a, b) => { if (b === 0) throw 4; return (a % b) | 0; });
          break;
        case 0x15: // DIVU, operands read unsigned
          bin(st, (a, b) => { if (b === 0) throw 4; return ((a >>> 0) / (b >>> 0)) | 0; });
          break;
        case 0x16: // MODU, operands read unsigned
          bin(st, (a, b) => { if (b === 0) throw 4; return ((a >>> 0) % (b >>> 0)) | 0; });
          break;
        case 0x17: un(st, (a) => (-a) | 0); break; // NEG, wraps
        case 0x18: bin(st, (a, b) => a & b); break; // AND
        case 0x19: bin(st, (a, b) => a | b); break; // OR
        case 0x1a: bin(st, (a, b) => a ^ b); break; // XOR
        case 0x1b: un(st, (a) => ~a); break; // NOT
        case 0x1c: bin(st, (a, b) => a << (b & 31)); break; // SHL
        case 0x1d: bin(st, (a, b) => a >> (b & 31)); break; // SHR, arithmetic
        case 0x1e: bin(st, (a, b) => (a >>> (b & 31)) | 0); break; // SHRU, logical
        case 0x20: bin(st, (a, b) => (a === b ? 1 : 0)); break; // EQ
        case 0x21: bin(st, (a, b) => (a < b ? 1 : 0)); break; // LT, signed
        case 0x22: bin(st, (a, b) => ((a >>> 0) < (b >>> 0) ? 1 : 0)); break; // LTU
        case 0x30: // JMP, offset from the next instruction
          pc = next + i16(prog, pc + 1);
          continue;
        case 0x31: // JZ
          if (st.length < 1) throw 2;
          if (st.pop() === 0) { pc = next + i16(prog, pc + 1); continue; }
          break;
        case 0x32: // JNZ
          if (st.length < 1) throw 2;
          if (st.pop() !== 0) { pc = next + i16(prog, pc + 1); continue; }
          break;
        case 0x33: // CALL, pushes the next instruction's address
          if (cs.length >= MAX_CALLS) throw 7;
          cs.push(next);
          pc = u16(prog, pc + 1);
          continue;
        case 0x34: // RET
          if (cs.length === 0) throw 8;
          pc = cs.pop()!;
          continue;
        case 0x40: // LOAD
          if (st.length < 1) throw 2;
          { const addr = st.pop()!; if (addr < 0 || addr > 255) throw 6; st.push(mem[addr]); }
          break;
        case 0x41: // STORE (v addr --)
          if (st.length < 2) throw 2;
          { const addr = st.pop()!, v = st.pop()!; if (addr < 0 || addr > 255) throw 6; mem[addr] = v; }
          break;
        case 0x50: { // PRINT, decimal ASCII, no newline
          if (st.length < 1) throw 2;
          const s = String(st.pop());
          if (out.length + s.length > MAX_OUT) throw 11; // writes nothing
          for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
          break;
        }
        case 0x51: // PUTC, one byte
          if (st.length < 1) throw 2;
          if (out.length + 1 > MAX_OUT) throw 11;
          out.push(st.pop()! & 255);
          break;
        case 0x52: // IN, -1 once the input is used up
          if (st.length >= MAX_STACK) throw 3;
          st.push(ip < input.length ? input[ip++] : -1);
          break;
        case 0x53: // EXIT, low byte of v
          if (st.length < 1) throw 2;
          return { exit: st.pop()! & 255, out: Buffer.from(out) };
        default: throw 5; // unknown opcode
      }
      pc = next;
    }
  } catch (e) {
    if (typeof e === "number") return { exit: e, out: Buffer.from(out) };
    throw e;
  }
}


// Answer the whole set: i001..i040.
for (let n = 1; n <= 40; n++) {
  const id = "i" + String(n).padStart(3, "0");
  const prog = fs.readFileSync(path.join(IN_DIR, id, "program.bin"));
  const input = fs.readFileSync(path.join(IN_DIR, id, "input.bin"));
  const { exit, out } = run(prog, input);
  const dest = path.join(OUT_DIR, id);
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(path.join(dest, "stdout.bin"), out);
  fs.writeFileSync(path.join(dest, "exit.txt"), exit + "\n");
}
