# 增加Project概念

新增一些概念

``` typescript
// 项目
interface Project {
    // 唯一ID
    id: string;
    // 名称
    name: string;
    // 描述
    description: string;
    // 项目远程git地址
    repository_url?: string;
    // 创建时间
    createTime: Date;
    // 修改时间
    modifyTime: Date;
}

// 任务
interface Task {
    id: string;
    description: string;
    // 已完成、未完成、待处理
    status: string;
    // 创建时间
    createTime: Date;
    // 修改时间
    modifyTime: Date;
}
```

用户可以创建项目。每个项目会有多个任务。
首页修改为显示项目列表，并且可以创建项目。点击某个项目后，显示项目下的任务列表，并且可以创建任务。
使用 postgresql来存储数据。
帮我设计数据库，并提供对应迁移脚本使用Drizzle来操作数据库
