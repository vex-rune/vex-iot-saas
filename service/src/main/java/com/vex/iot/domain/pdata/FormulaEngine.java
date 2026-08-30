package com.vex.iot.domain.pdata;

import com.vex.iot.common.exception.BizException;
import com.vex.iot.common.exception.BusinessExceptions.BadRequestException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * 安全公式引擎:手写 tokenizer + 中缀求值。
 * 仅支持: 数字字面量、变量 $a、四则运算 + - * /、取模 %、圆括号、round(x) 函数。
 * 不使用 javax.script / Nashorn,杜绝任意 JS 代码注入.
 */
public final class FormulaEngine {
    private FormulaEngine() {
    }

    public static Object forward(String formula, Object rawValue) {
        return evaluate(formula, rawValue);
    }

    public static Object reverse(String formula, Object inputValue) {
        return evaluate(formula, inputValue);
    }

    private static Object evaluate(String formula, Object value) {
        if (formula == null || formula.isBlank()) return value;
        List<Token> tokens;
        try {
            tokens = tokenize(formula);
        } catch (BizException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BadRequestException("公式语法错误: " + formula);
        }
        List<Token> rpn = toRpn(tokens);
        return calc(rpn, value);
    }

    // ====== Tokenizer ======
    private static List<Token> tokenize(String formula) {
        List<Token> list = new ArrayList<>();
        int i = 0, n = formula.length();
        while (i < n) {
            char c = formula.charAt(i);
            if (Character.isWhitespace(c)) {
                i++;
                continue;
            }
            if (c == '$' && i + 1 < n && formula.charAt(i + 1) == 'a') {
                list.add(new VarToken());
                i += 2;
                continue;
            }
            if (Character.isDigit(c) || c == '.') {
                int j = i;
                boolean dot = c == '.';
                while (j < n) {
                    char cj = formula.charAt(j);
                    if (Character.isDigit(cj)) j++;
                    else if (cj == '.' && !dot) {
                        dot = true;
                        j++;
                    } else break;
                }
                list.add(new NumToken(new BigDecimal(formula.substring(i, j))));
                i = j;
                continue;
            }
            if (isLetterStart(c)) {
                int j = i;
                while (j < n && isLetterPart(formula.charAt(j))) j++;
                String name = formula.substring(i, j);
                if ("round".equals(name)) list.add(new FnToken("round", 1));
                else throw new BadRequestException("不支持的函数: " + name);
                i = j;
                continue;
            }
            if ("+-*/%".indexOf(c) >= 0) {
                boolean rightAssoc = (c == '+' || c == '-') && (list.isEmpty()
                        || (list.get(list.size() - 1) instanceof OpToken));
                list.add(new OpToken(String.valueOf(c), precedence(c), rightAssoc));
                i++;
                continue;
            }
            if (c == '(' || c == ')') {
                list.add(new OpToken(String.valueOf(c), -1, false));
                i++;
                continue;
            }
            if (c == ',') {
                list.add(new OpToken(",", -2, false));
                i++;
                continue;
            }
            throw new BadRequestException("公式包含非法字符: " + c);
        }
        return list;
    }

    private static boolean isLetterStart(char c) {
        return Character.isLetter(c) || c == '_';
    }

    private static boolean isLetterPart(char c) {
        return Character.isLetterOrDigit(c) || c == '_';
    }

    private static int precedence(char c) {
        return switch (c) {
            case '+', '-' -> 1;
            case '*', '/', '%' -> 2;
            default -> 0;
        };
    }

    // ====== 中缀 -> 逆波兰 ======
    private static List<Token> toRpn(List<Token> tokens) {
        List<Token> out = new ArrayList<>();
        List<Token> stack = new ArrayList<>();
        for (Token t : tokens) {
            if (t instanceof NumToken || t instanceof VarToken) {
                out.add(t);
            } else if (t instanceof FnToken) {
                stack.add(t);
            } else if (t instanceof OpToken op) {
                if (",".equals(op.op())) {
                    while (!stack.isEmpty() && !(stack.get(stack.size() - 1) instanceof OpToken s && "(".equals(s.op()))) {
                        out.add(stack.remove(stack.size() - 1));
                    }
                } else if ("(".equals(op.op())) {
                    stack.add(op);
                } else if (")".equals(op.op())) {
                    while (!stack.isEmpty() && !(stack.get(stack.size() - 1) instanceof OpToken s && "(".equals(s.op()))) {
                        out.add(stack.remove(stack.size() - 1));
                    }
                    if (stack.isEmpty()) throw new BadRequestException("括号不匹配");
                    stack.remove(stack.size() - 1);
                    if (!stack.isEmpty() && stack.get(stack.size() - 1) instanceof FnToken) {
                        out.add(stack.remove(stack.size() - 1));
                    }
                } else {
                    while (!stack.isEmpty() && stack.get(stack.size() - 1) instanceof OpToken top
                            && (top.precedence() > op.precedence()
                            || (top.precedence() == op.precedence() && !op.rightAssoc))) {
                        out.add(stack.remove(stack.size() - 1));
                    }
                    stack.add(op);
                }
            }
        }
        while (!stack.isEmpty()) {
            Token top = stack.remove(stack.size() - 1);
            if (top instanceof OpToken ot && ("(".equals(ot.op()) || ")".equals(ot.op())))
                throw new BadRequestException("括号不匹配");
            out.add(top);
        }
        return out;
    }

    // ====== 逆波兰求值 ======
    private static Object calc(List<Token> rpn, Object value) {
        List<Object> stack = new ArrayList<>();
        for (Token t : rpn) {
            if (t instanceof NumToken(BigDecimal value1)) {
                stack.add(value1);
            } else if (t instanceof VarToken) {
                stack.add(toBigDecimal(value));
            } else if (t instanceof OpToken op) {
                if ("+".equals(op.op()) || "-".equals(op.op()) || "*".equals(op.op())
                        || "/".equals(op.op()) || "%".equals(op.op())) {
                    if (stack.size() < 2) throw new BadRequestException("公式操作数不足");
                    BigDecimal b = (BigDecimal) stack.remove(stack.size() - 1);
                    BigDecimal a = (BigDecimal) stack.remove(stack.size() - 1);
                    stack.add(applyBinary(a, op.op(), b));
                }
            } else if (t instanceof FnToken(String name, int argCount)) {
                if (name.equals("round")) {
                    if (stack.size() < argCount)
                        throw new BadRequestException("round 参数不足");
                    BigDecimal a = (BigDecimal) stack.remove(stack.size() - 1);
                    stack.add(a.setScale(0, RoundingMode.HALF_UP));
                }
            }
        }
        if (stack.size() != 1) throw new BadRequestException("公式结果无效");
        Object result = stack.get(0);
        return result instanceof BigDecimal bd ? bd.stripTrailingZeros().toPlainString() : result;
    }

    private static BigDecimal toBigDecimal(Object value) {
        if (value == null) throw new BadRequestException("$a 不能为空");
        if (value instanceof BigDecimal bd) return bd;
        if (value instanceof Number n) return new BigDecimal(n.toString());
        try {
            return new BigDecimal(value.toString());
        } catch (NumberFormatException ex) {
            throw new BadRequestException("$a 不是数字: " + value);
        }
    }

    private static BigDecimal applyBinary(BigDecimal a, String op, BigDecimal b) {
        return switch (op) {
            case "+" -> a.add(b);
            case "-" -> a.subtract(b);
            case "*" -> a.multiply(b);
            case "/" -> {
                if (b.signum() == 0) throw new BadRequestException("除数不能为 0");
                yield a.divide(b, 10, RoundingMode.HALF_UP);
            }
            case "%" -> a.remainder(b);
            default -> throw new BadRequestException("未知操作符: " + op);
        };
    }

    // ====== Token 类型 ======
    private sealed interface Token permits NumToken, VarToken, OpToken, FnToken {
    }

    private record NumToken(BigDecimal value) implements Token {
    }

    private record VarToken() implements Token {
    }

    private record OpToken(String op, int precedence, boolean rightAssoc) implements Token {
    }

    private record FnToken(String name, int argCount) implements Token {
    }
}
