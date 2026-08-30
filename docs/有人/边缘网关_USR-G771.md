# USR-G771 Cat-1 DTU

> 产品来源：<https://www.usr.cn/Product/296.html>
> 产品规格：<https://www.usr.cn/wiki/puba/KIWL4cBTk#top>
> 类别：边缘网关 / 数传 DTU


## 一、产品概述

USR-G771 是有人物联网推出的首款 Cat-1 DTU。该产品具备高速率、低延迟的特点，支持三大运营商 Cat-1 网络接入，同时支持移动和联通 2G 网络接入；产品采用工业级设计标准，内置独立硬件看门狗，同时支持 FOTA 远程升级，为高可靠性提供保证；宽电压端子供电，RS232 和 RS485 两种标准端子接口，客户使用更方便，适用性更强；产品自带导轨卡扣，安装方便。

> **型号说明**
> - **USR-G771**：常规版
> - **USR-G771-GL**：隔离版

### 产品亮点

- **边缘计算**：支持 MQTT 通道下以 JSON 格式上报数据
- **双路 MQTT**：双路 MQTT 互不影响
- **多重协议**：MQTT、TCP、UDP、HTTP、Modbus
- **数据安全**：支持 SSL/TLS 加密传输

---

## 二、参数说明

### 2.1 基本参数

| 参数项 | 描述 |
| --- | --- |
| 网络制式 | 支持移动、联通、电信 4G Cat-1 |
| 电源 | DC 9V ~ 36V |
| 工作电流（功耗） | 平均：21mA - 50mA<br>最大：54mA（12V） |
| 状态指示灯 | PWR、WORK、NET、LINK1、LINK2、2G、CAT1、信号强度指示灯 |
| 尺寸（mm） | 96.6 × 90.02 × 33.85 |

### 2.2 频段信息

| 参数项 | 描述 |
| --- | --- |
| TDD-LTE | Band 38/39/40/41 |
| FDD-LTE | Band 1/3/5/8 |

### 2.3 技术规范

| 参数项 | 描述 |
| --- | --- |
| TDD-LTE | 下行速率 7.5 Mbps<br>上行速率 1 Mbps |
| FDD-LTE | 下行速率 10 Mbps<br>上行速率 5 Mbps |

### 2.4 功率等级

| 参数项 | 描述 |
| --- | --- |
| TDD-LTE | +23dBm（Power class 3） |
| FDD-LTE | +23dBm（Power class 3） |

### 2.5 串口规格

| 参数项 | 描述 |
| --- | --- |
| 串口数量 | RS232 × 1 / RS485 × 1（不可同时使用） |
| 串口引脚 | RS232：端子，TX/RX/GND<br>RS485：端子，A/B |
| 数据位（bit） | 8 |
| 停止位（bit） | 1，2 |
| 检验位 | NONE，ODD，EVEN |
| 波特率（bps） | 1200 ~ 230400 |

### 2.6 硬件接口

| 参数项 | 描述 |
| --- | --- |
| SIM/USIM 卡 | 卡 1：3V/1.8V SIM 卡槽，Mini-SIM 卡（传统大卡）<br>卡 2：内置电信贴片 eSIM 卡 |
| 流量 | 出厂即送 8 年流量，100M/月 |
| 天线接口 | SMA 外螺内孔 |

### 2.7 温湿度范围

| 参数项 | 描述 |
| --- | --- |
| 工作温度 | -25℃ ~ +75℃ |
| 存储温度 | -40℃ ~ 90℃ |
| 工作湿度 | 5% ~ 95%（无凝露） |
| 存储湿度 | 5% ~ 95%（无凝露） |

### 2.8 基本功能

| 参数项 | 描述 |
| --- | --- |
| 工作模式 | TCP/UDP 透传模式、HTTPD 模式、短信透传模式、MQTT 模式、MODBUS 轮询采集模式 |
| 扫码配置 | 支持 |
| SSL/TLS 加密 | 支持，全新升级支持 TLS 1.3 |
| GNSS 全球定位 | 不支持 |
| 断电上报 | 不支持 |
| 双 MQTT | 支持 |
| MODBUS 自主轮询 | 支持，全新升级双路均可选 MQTT 5.0 版 |
| Socket 数量 | 4 路，另支持 4 路 Socket 备份 |
| 心跳包 | 支持自定义心跳包 / SN 心跳包 / ICCID 心跳包 / IMEI 心跳包 / LBS |
| 注册包 | 支持自定义注册包 / SN 注册包 / ICCID 注册包 / IMEI 注册包 |
| 其他功能 | 套接字分发、FTP 他升级、FOTA 升级、基站定位、NTP 校时功能 |

### 2.9 可靠性

| 参数项 | 描述 |
| --- | --- |
| 静电放电抗扰度 | 标准版：接触 6KV，空气 8KV<br>隔离版（-GL）：接触 8KV，空气 15KV |
| 浪涌（冲击）抗扰度 | 标准版：差模 1KV，RS-485 回路 1KV<br>隔离版（-GL）：差模 2KV，RS-485 回路 2KV |
| 快速脉冲群 | 标准版：电源回路 2KV，RS-485 回路 1KV<br>隔离版（-GL）：电源回路 4KV，RS-485 回路 2KV |

---

## 三、产品资料链接

| 资料类型 | 链接 | 说明 |
| --- | --- | --- |
| 产品手册 | <https://www.usr.cn/wiki/puba/KIWL4cBTk> | 正式的产品说明书、规格书 |
| 配置示例 | <https://www.usr.cn/wiki/puba/6rF4OZmps> | 最佳实践案例，操作步骤指引 |
| 相关软件 | <https://www.usr.cn/wiki/puba/V0MSGYSXr> | 配置软件、调试工具、应用软件 |
| 售前选型 | <https://www.usr.cn/wiki/puba/NUOutXVYs> | 售前选型指导 |
| 相关视频 | <https://www.usr.cn/wiki/puba/zfFAqToHX> | 产品使用、配置视频教程 |

---

## 四、购买渠道

| 渠道 | 入口 | 直达链接 |
| --- | --- | --- |
| 有人官方商城 | 官网商城 | <http://shop.usr.cn/cat1-dtu/lte.html> |
| 天猫旗舰店 | 天猫商城 | <http://detail.tmall.com/item.htm?id=626934128940> |
| 京东旗舰店 | 京东商城 | <https://item.jd.com/10107295167936.html> |
| 官方淘宝店 | 淘宝商城 | <http://item.taobao.com/item.htm?id=627555446597> |
| 智泽天猫 | 第三方代理 | <https://zhizesm.tmall.com/> |

---

## 五、相关产品

| 产品 | 链接 | 特点 |
| --- | --- | --- |
| USR-G776 | <https://www.usr.cn/Product/255.html> | 1×RS232/RS485；4G Cat.4；5 模 13 频 4G DTU |
| DR154 系列（爆款口红 DTU） | <https://www.usr.cn/Product/313.html> | 1×RS485/RS232；4G Cat.1；口红爆款 |