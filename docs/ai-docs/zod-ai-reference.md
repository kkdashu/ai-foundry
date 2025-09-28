# Zod 快速参考指南 - AI代码生成版

## 1. 安装与导入

```bash
npm install zod
```

```typescript
import { z } from "zod";
// 或
import * as z from "zod";
```

## 2. 基础类型

```typescript
// 原始类型
z.string()                    // string
z.number()                    // number
z.boolean()                   // boolean
z.date()                      // Date
z.bigint()                    // bigint
z.symbol()                    // symbol

// 特殊类型
z.undefined()                 // undefined
z.null()                      // null
z.void()                      // void
z.any()                       // any
z.unknown()                   // unknown
z.never()                     // never
z.nan()                       // NaN

// 字面量
z.literal("hello")            // "hello"
z.literal(42)                 // 42
z.literal(true)               // true
```

## 3. 字符串验证

```typescript
z.string()
  .min(1, "至少1个字符")
  .max(100, "最多100个字符")
  .length(5, "必须5个字符")
  .email("无效的邮箱")
  .url("无效的URL")
  .uuid("无效的UUID")
  .regex(/^[A-Z]/, "必须以大写字母开头")
  .startsWith("https://", "必须以https://开头")
  .endsWith(".com", "必须以.com结尾")
  .includes("@", "必须包含@")
  .trim()                     // 移除首尾空格
  .toLowerCase()              // 转小写
  .toUpperCase()              // 转大写
```

## 4. 数字验证

```typescript
z.number()
  .int("必须是整数")
  .positive("必须是正数")
  .negative("必须是负数")
  .nonnegative("不能是负数")
  .nonpositive("不能是正数")
  .min(0, "最小值0")
  .max(100, "最大值100")
  .multipleOf(5, "必须是5的倍数")
  .finite("必须是有限数")
  .safe("必须是安全整数")
```

## 5. 对象

```typescript
// 基础对象
const User = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().email()
});

// 嵌套对象
const Post = z.object({
  title: z.string(),
  author: z.object({
    name: z.string(),
    email: z.string().email()
  }),
  tags: z.array(z.string())
});

// 对象方法
const schema = z.object({ name: z.string() });

schema.extend({ age: z.number() })      // 扩展
schema.merge(otherSchema)                // 合并
schema.pick({ name: true })             // 选择字段
schema.omit({ name: true })             // 排除字段
schema.partial()                         // 所有字段可选
schema.required()                        // 所有字段必需
schema.deepPartial()                     // 深度可选
schema.keyof()                          // 获取键的枚举

// 未知键处理
schema.strict()                          // 拒绝未知键
schema.strip()                           // 移除未知键（默认）
schema.passthrough()                     // 保留未知键
```

## 6. 数组

```typescript
// 基础数组
z.array(z.string())                     // string[]
z.string().array()                      // 等同于上面

// 数组约束
z.array(z.string())
  .nonempty("数组不能为空")
  .min(1, "至少1个元素")
  .max(10, "最多10个元素")
  .length(5, "必须5个元素")

// 元组
z.tuple([z.string(), z.number(), z.boolean()])  // [string, number, boolean]

// Rest元素
z.tuple([z.string()]).rest(z.number())  // [string, ...number[]]
```

## 7. 联合与交叉类型

```typescript
// 联合类型
z.union([z.string(), z.number()])       // string | number
// 简写
z.string().or(z.number())               // string | number

// 可辨识联合（性能更好）
z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), content: z.string() }),
  z.object({ type: z.literal("image"), url: z.string().url() })
]);

// 交叉类型
z.intersection(
  z.object({ name: z.string() }),
  z.object({ age: z.number() })
);                                       // { name: string } & { age: number }
// 简写
z.object({ name: z.string() }).and(z.object({ age: z.number() }))
```

## 8. 可选与可空

```typescript
// 可选（undefined）
z.string().optional()                   // string | undefined

// 可空（null）
z.string().nullable()                   // string | null

// 可选且可空
z.string().nullish()                    // string | null | undefined

// 默认值
z.string().default("默认值")
z.number().default(() => Date.now())    // 函数默认值

// Catch - 解析失败时使用默认值
z.string().catch("fallback")
```

## 9. 转换与精炼

```typescript
// 转换 - 改变类型
const stringToNumber = z.string().transform(val => parseInt(val, 10));
const toLowerCase = z.string().transform(val => val.toLowerCase());

// 精炼 - 添加自定义验证
z.string().refine(val => val.length > 0, "不能为空");

z.string().refine(
  val => /^[A-Z]/.test(val),
  { message: "必须以大写字母开头" }
);

// 多个精炼
z.string()
  .min(8)
  .refine(val => /[A-Z]/.test(val), "需要大写字母")
  .refine(val => /[0-9]/.test(val), "需要数字")
  .refine(val => /[!@#$%]/.test(val), "需要特殊字符");

// SuperRefine - 多个错误
z.string().superRefine((val, ctx) => {
  if (val.length < 8) {
    ctx.addIssue({
      code: z.ZodIssueCode.too_small,
      minimum: 8,
      type: "string",
      inclusive: true,
      message: "密码太短"
    });
  }
  if (!/[A-Z]/.test(val)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "需要大写字母"
    });
  }
});

// 异步精炼
z.string().refine(
  async val => await checkEmailExists(val),
  "邮箱已存在"
);
```

## 10. 枚举与常量

```typescript
// 枚举
const Status = z.enum(["pending", "approved", "rejected"]);
type Status = z.infer<typeof Status>;   // "pending" | "approved" | "rejected"

// 从数组创建枚举
const fruits = ["apple", "banana", "orange"] as const;
const Fruit = z.enum(fruits);

// 原生枚举
enum NativeEnum {
  Pending = "pending",
  Approved = "approved"
}
z.nativeEnum(NativeEnum);

// 枚举方法
Status.enum                             // { pending: "pending", ... }
Status.options                          // ["pending", "approved", "rejected"]
Status.extract(["pending"])             // 新枚举只包含pending
Status.exclude(["rejected"])            // 新枚举不包含rejected
```

## 11. Record与Map

```typescript
// Record - 对象的键值对
z.record(z.string())                    // Record<string, string>
z.record(z.string(), z.number())        // Record<string, number>

// 限定键
const Keys = z.enum(["id", "name", "email"]);
z.record(Keys, z.string())              // { id: string; name: string; email: string }

// Map
z.map(z.string(), z.number())           // Map<string, number>

// Set
z.set(z.string())                        // Set<string>
z.set(z.number()).min(1).max(3)         // Set至少1个最多3个元素
```

## 12. 解析方法

```typescript
const schema = z.object({
  name: z.string(),
  age: z.number()
});

// parse - 失败时抛出错误
try {
  const data = schema.parse(input);     // 类型安全的数据
} catch (error) {
  if (error instanceof z.ZodError) {
    console.log(error.issues);          // 验证错误详情
  }
}

// safeParse - 返回结果对象，不抛出错误
const result = schema.safeParse(input);
if (result.success) {
  console.log(result.data);             // 验证成功的数据
} else {
  console.log(result.error);            // ZodError对象
}

// 异步版本
await schema.parseAsync(input);
await schema.safeParseAsync(input);

// 部分解析（只验证提供的字段）
schema.partial().safeParse({ name: "Alice" });
```

## 13. 类型推断

```typescript
// 推断输出类型
const UserSchema = z.object({
  name: z.string(),
  age: z.number()
});
type User = z.infer<typeof UserSchema>; // { name: string; age: number }

// 推断输入类型（转换前）
const TransformSchema = z.string().transform(val => parseInt(val));
type Input = z.input<typeof TransformSchema>;   // string
type Output = z.output<typeof TransformSchema>; // number
```

## 14. 错误处理

```typescript
// 自定义错误消息
z.string().min(5, "至少5个字符");
z.number().max(100, { message: "不能超过100" });

// 动态错误消息
z.string().min(5, val => `${val}太短了，至少需要5个字符`);

// 格式化错误
const result = schema.safeParse(data);
if (!result.success) {
  // 格式化为嵌套对象
  const formatted = result.error.format();
  // { name: { _errors: ["Required"] }, age: { _errors: ["Expected number"] } }

  // 扁平化错误
  const flattened = result.error.flatten();
  // { formErrors: [], fieldErrors: { name: ["Required"], age: ["Expected number"] } }

  // 获取所有问题
  const issues = result.error.issues;
  // [{ path: ["name"], message: "Required", ... }, ...]
}

// 自定义错误映射
const customErrorMap: z.ZodErrorMap = (issue, ctx) => {
  if (issue.code === z.ZodIssueCode.invalid_type) {
    return { message: `期望${issue.expected}，收到${issue.received}` };
  }
  return { message: ctx.defaultError };
};

z.setErrorMap(customErrorMap);
```

## 15. 常见模式

### 表单验证
```typescript
const LoginForm = z.object({
  email: z.string().email("请输入有效邮箱"),
  password: z.string()
    .min(8, "密码至少8位")
    .regex(/[A-Z]/, "需要包含大写字母")
    .regex(/[0-9]/, "需要包含数字"),
  rememberMe: z.boolean().optional().default(false)
});
```

### API响应验证
```typescript
const ApiResponse = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string()
  }).optional(),
  timestamp: z.string().datetime()
});
```

### 环境变量验证
```typescript
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)),
  DATABASE_URL: z.string().url(),
  API_KEY: z.string().min(1),
  ENABLE_DEBUG: z.string().transform(val => val === "true").optional()
});

const env = EnvSchema.parse(process.env);
```

### 递归模式
```typescript
// 递归类型需要使用lazy
type Category = {
  name: string;
  subcategories: Category[];
};

const CategorySchema: z.ZodType<Category> = z.lazy(() =>
  z.object({
    name: z.string(),
    subcategories: z.array(CategorySchema)
  })
);
```

### 文件上传验证
```typescript
const FileUpload = z.object({
  name: z.string().regex(/\.(jpg|jpeg|png|gif)$/i, "只允许图片文件"),
  size: z.number().max(5 * 1024 * 1024, "文件不能超过5MB"),
  type: z.enum(["image/jpeg", "image/png", "image/gif"])
});
```

### 分页参数验证
```typescript
const PaginationParams = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).default("1"),
  pageSize: z.string().transform(Number).pipe(z.number().min(1).max(100)).default("10"),
  sortBy: z.enum(["createdAt", "updatedAt", "name"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("asc")
});
```

## 16. 高级技巧

### Preprocess - 预处理输入
```typescript
// 转换输入后再验证
z.preprocess(
  input => String(input).trim().toLowerCase(),
  z.enum(["red", "green", "blue"])
);
```

### Pipeline - 链式验证
```typescript
// Zod 3语法
z.string()
  .transform(val => val.split(","))
  .pipe(z.array(z.string()));

// 解析 "a,b,c" => ["a", "b", "c"]
```

### Brand - 品牌类型
```typescript
const UserId = z.string().brand<"UserId">();
type UserId = z.infer<typeof UserId>;   // string & { [brand]: "UserId" }

// 防止混淆不同类型的字符串ID
function getUser(id: UserId) { /* ... */ }
```

### 函数模式
```typescript
const myFunction = z.function()
  .args(z.string(), z.number())         // 参数类型
  .returns(z.boolean())                 // 返回类型
  .implement((str, num) => {            // 实现
    return str.length > num;
  });
```

## 快速查阅表

| 需求 | 代码 |
|------|------|
| 必填字符串 | `z.string().min(1)` |
| 可选字符串 | `z.string().optional()` |
| 带默认值 | `z.string().default("默认")` |
| 邮箱验证 | `z.string().email()` |
| URL验证 | `z.string().url()` |
| 正整数 | `z.number().int().positive()` |
| 枚举 | `z.enum(["a", "b", "c"])` |
| 日期 | `z.date()` 或 `z.string().datetime()` |
| UUID | `z.string().uuid()` |
| 数组不为空 | `z.array(z.string()).nonempty()` |
| 对象部分可选 | `schema.partial()` |
| 联合类型 | `z.union([z.string(), z.number()])` |
| 自定义验证 | `.refine(val => condition, "错误消息")` |
| 转换类型 | `.transform(val => newVal)` |
| 异步验证 | `.refine(async val => await check(val))` |

---

*本文档专门为AI代码生成优化，包含Zod最常用的功能和模式。更多详情请访问 [zod.dev](https://zod.dev/)*