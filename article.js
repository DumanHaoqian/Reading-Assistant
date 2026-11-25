(() => {
  const paperUrl = 'https://arxiv.org/abs/2605.05204';
  const projectUrl = 'https://vvvvvjdy.github.io/d-opsd/';
  const codeUrl = 'https://github.com/vvvvvjdy/D-OPSD';
  const paperTitle = 'D-OPSD: On-Policy Self-Distillation for Continuously Tuning Step-Distilled Diffusion Models';
  const paper = `<a href="${paperUrl}">《${paperTitle}》</a>`;

  function figure(number, alt, caption) {
    return `<figure><img src="assets/figure-${number}.png" alt="${alt}"><figcaption><strong>图 ${number}：</strong> ${caption} 来源：${paper}。</figcaption></figure>`;
  }

  function equation(label, mathml) {
    return `<div class="equation"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block" aria-label="${label}">${mathml}</math></div>`;
  }

  const inline = mathml => `<math xmlns="http://www.w3.org/1998/Math/MathML">${mathml}</math>`;
  const thetaBar = '<mover><mi>θ</mi><mo>¯</mo></mover>';
  const theta = '<mi>θ</mi>';
  const studentCondition = '<msub><mi>c</mi><mi mathvariant="normal">s</mi></msub>';
  const teacherCondition = '<msub><mi>c</mi><mi mathvariant="normal">t</mi></msub>';
  const x0 = '<msub><mi>x</mi><mn>0</mn></msub>';
  const xt = '<msub><mi>x</mi><mi>t</mi></msub>';
  const tk = index => `<msub><mi>t</mi><mrow>${index}</mrow></msub>`;
  const k = '<mi>k</mi>';
  const previous = '<mi>k</mi><mo>−</mo><mn>1</mn>';
  const state = index => `<msubsup><mi>x</mi>${tk(index)}<mi mathvariant="normal">s</mi></msubsup>`;
  const velocity = parameter => `<msub><mi>v</mi>${parameter}</msub>`;
  const prediction = role => `<msubsup><mi>u</mi><mi>k</mi><mi mathvariant="normal">${role}</mi></msubsup>`;
  const trajectory = `<msubsup><mrow><mo>{</mo>${state(k)}<mo>}</mo></mrow><mrow><mi>k</mi><mo>=</mo><mn>1</mn></mrow><mi>K</mi></msubsup>`;
  const loss = '<msub><mi>ℒ</mi><mtext>D−OPSD</mtext></msub>';
  const ohat = '<mover><mi>o</mi><mo>^</mo></mover>';
  const policy = (parameter, condition) => `<msub><mi>π</mi>${parameter}</msub><mo>(</mo><mo>·</mo><mo>∣</mo>${condition}<mo>)</mo>`;
  const weak = policy(theta, '<mi>q</mi>');
  const strong = policy(thetaBar, '<mi>q</mi><mo>,</mo><mi>r</mi>');
  const gap = '<span class="transcription-gap" title="截图在此处截断" aria-label="截图在此处截断">〔…〕</span>';

  document.getElementById('article-body').innerHTML = `
    <blockquote>公众号：叫我Alonzo就好了<br>
      论文地址： ${paper}<br>
      开源代码： <a href="${codeUrl}">GitHub</a><br>
      项目主页： <a href="${projectUrl}">Project Page</a></blockquote>

    <h2 id="motivation">一、D-OPSD 的研究动机</h2>
    <p>近一年文生图社区的演进呈现出显著趋势：开源高性能基座的重心正从几十步迭代去噪的多步模型，快速转向经过 step-distillation 的少步 diffusion model，代表作包括阿里团队的 <a href="https://huggingface.co/Tongyi-MAI/Z-Image-Turbo">Z-Image-Turbo</a>（8 步采样）和 Black Forest Labs 的 <a href="https://huggingface.co/black-forest-labs/FLUX.2-klein-4B">FLUX.2-klein</a>（4 步采样）。在 <a href="https://arxiv.org/abs/2311.18828">DMD</a>、<a href="https://arxiv.org/abs/2405.14867">DMD2</a> 等分布匹配蒸馏技术加持下，这批少步基座将 NFE（Number of Function Evaluations）压缩到个位数的同时，生成画质甚至能反超早期多步模型，已成为生产部署与社区二次开发的首选。</p>
    <p>但当我们拿到这类少步 diffusion model，准备在私有图文 dataset 上继续微调（例如定制特定主体概念、迁移画风或对齐垂类 domain 偏好）时，却会面临一个棘手难题：只要照搬多步模型的 vanilla SFT，用加噪目标图像回归 flow matching 或 rectified flow 的速度场，模型很快就会丢失少${gap}</p>
    <p>少步 diffusion model 在继续微调后发生退化，症结在于训练与推理过程严重的 train-test mismatch。在 vanilla SFT 中，给定目标图像 ${inline(x0)} 与文本 prompt ${inline('<mi>y</mi>')}，送入 diffusion denoiser 的带噪 latents ${inline(xt)} 由外部目标图像 ${inline(x0)} 与高斯噪声直接插值得到，属于 off-policy 外部数据分布，而 optimization objective 则是推理时并不存在的 ground-truth 速度场。换言之，vanilla SFT 强迫网络去拟合它自身少步 sampler 在 roll-out 推理轨迹上几乎不会访问到的状态。传统 50 步、100 步的多步 diffusion model 还能依靠后续几十步迭代逐步修正轻微偏差，但少步 diffusion model 的画质高度依赖 4 步或 8 步精密对齐的离散跳步更新，容错空间极小，一旦 off-policy 信号诱发原有的少步采样轨迹发生 distribution shift，推理表现就会直接崩塌。</p>
    <p>顺着消除 train-test mismatch 的思路审视现有方案，<a href="https://arxiv.org/abs/2304.05977">ReFL</a>、<a href="https://arxiv.org/abs/2505.05470">Flow-GRPO</a> 等 online RL 方案直接在当前模型自主采样的 on-policy 轨迹上回传梯度，确实不会破坏少步能力。然而 online RL 强依赖精心设计的 reward function 或专用 reward model，开发者手里往往只有几张到几千张图文对，很难针对特定主体 ID 或小众画风训练出可靠的 reward model。至于「先微调多步基座、再重新执行步长蒸馏」的二阶段 pipeline，一方面主流少步基座大多未完整公开闭源蒸馏的 training recipe，另一方面重新执行蒸馏的算力开销也远超常规微调预算。</p>
    <p>基于这一困境，香港科技大学与阿里 Z-Image 团队在 NeurIPS 2026 录用的 <a href="${paperUrl}">D-OPSD</a>（<a href="${projectUrl}">项目主页</a>与<a href="${codeUrl}">官方代码</a>均已开源）中给出了清晰的 motivation：理想的持续微调方案应当兼顾 online 优化的轨迹一致性与图文对的有监督信号，在模型自身的少步 on-policy 轨迹上更新参数，同时直接利用目标图像提供监督，省去外部 reward model 与二阶段重蒸馏。</p>

    <h2 id="method">二、D-OPSD 与现有微调范式的差异及技术细节</h2>
    <p>若从监督信号来源、是否满足 on-policy、是否依赖 reward model 及训练推理一致性四个维度横向对比现有方案，各路线的差异可归纳如下：</p>
    <ul>
      <li><strong>Vanilla SFT 与 <a href="https://arxiv.org/abs/2208.12242">DreamBooth</a></strong>：依赖离线 ground-truth 速度场作为回归目标，输入状态由外部图像线性插值构造，严重偏离少步推理轨迹。</li>
      <li><strong>Offline 偏好优化（<a href="https://arxiv.org/abs/2311.12908">Diffusion-DPO</a> 与 <a href="https://arxiv.org/abs/2410.03190">PSO</a>）</strong>：虽然限制在少步离散时间步上拉大成对样本似然间隔，但输入状态仍由离线目标图像诱导，监督依然停留在 ground-truth 速度场对上，并未真正回到 student 当前的采样分布。</li>
      <li><strong>Online RL（<a href="https://arxiv.org/abs/2304.05977">ReFL</a> 与 <a href="https://arxiv.org/abs/2505.05470">Flow-GRPO</a>）</strong>：满足 on-policy 轨迹采样，但受困于外部 reward model 的设计成本与 reward hacking 风险，难以直接消费成对图文监督数据。</li>
      <li><strong>D-OPSD</strong>：借鉴近期 LLM 持续学习中的 <a href="https://arxiv.org/abs/2601.18734">OPSD</a> 思想，用同一模型在强上下文下预测的自蒸馏速度场提供监督，单阶段同时满足 on-policy 采样、无需外部 reward model 与保持少步推理轨迹一致性。</li>
    </ul>
    <p>在 <a href="https://arxiv.org/abs/2601.19897">Self-Distillation Enables Continual Learning</a> 与 <a href="https://arxiv.org/abs/2601.18734">Self-Distilled Reasoner</a> 等 LLM 工作中，OPSD 让同一模型在不同上下文下承担双重角色：给定查询 ${inline('<mi>q</mi>')} 与特权上下文 ${inline('<mi>r</mi>')}（如参考答案），student 在弱上下文 ${inline('<mi>q</mi>')} 下采样输出 ${inline(ohat + '<mo>∼</mo>' + weak)}，teacher 在强上下文 ${inline('<mo>(</mo><mi>q</mi><mo>,</mo><mi>r</mi><mo>)</mo>')} 下给出分布 ${inline(strong)}，并在 student 自采样序列上最小化分布散度：</p>
    ${equation('LLM OPSD 自蒸馏损失', `<msubsup><mi>ℒ</mi><mtext>OPSD</mtext><mtext>LLM</mtext></msubsup><mo>=</mo><msub><mi>𝔼</mi><mrow>${ohat}<mo>∼</mo>${weak}</mrow></msub><mo>[</mo><mi>D</mi><mo>(</mo>${strong}<mo>,</mo>${weak}<mo>)</mo><mo>]</mo>`)}
    <p>但将这套机制迁移到 diffusion model 并非易事。LLM 中的额外信息 ${inline('<mi>r</mi>')} 是文本 token，直接拼接到输入序列即可；而图像生成的监督信号是一张连续 2D image ${inline(x0)}，一旦把加噪目标图像直接送入去噪过程，就会篡改采样轨迹，退化回类似 teacher forcing 的 off-policy SFT。核心难点在于如何在不触碰 student 少步采样轨迹的前提下，把目标图像 ${inline(x0)} 作为强上下文输入给 teacher。</p>
    ${figure(1, '主体概念与艺术风格的零样本生成对比', '少步文生图基座 Z-Image-Turbo 的零样本 in-context 生成能力验证。得益于上游 LLM/VLM 级 encoder 的表征能力，无需任何微调，直接将文本 prompt 与目标图像共同编码为多模态条件（<code>gen w/ text+img</code>），模型即可在少步采样下生成保留目标主体概念（左）或艺术风格（右）的图像。')}
    <p>作者在此利用了现代文生图基座的一项 emergent property。不同于早期采用 CLIP 或 T5 充当 encoder 的模型，如今 Z-Image-Turbo 与 FLUX.2-klein 等基座默认采用 <a href="https://huggingface.co/Qwen/Qwen3-4B">Qwen3-4B</a> 这类 LLM/VLM 作为 backbone 级 encoder。如上图所示，零样本实验表明下游 Diffusion Transformer 天然继承了上游 encoder 的 in-context 能力：无需任何额外训练，只要将纯文本条件替换为「文本 prompt + 目标图像」提取的多模态特征，少步基座就能直接生成保留目标概念或画风的图像变体。这意味着目标图像完全不必作为去噪终点，而是可以经由 encoder 转化为 teacher 的 in-context 条件。</p>
    ${figure(2, 'D-OPSD 的训练流程与师生模型监督路径', `D-OPSD 整体训练 pipeline 示意图。给定文本 prompt 与目标图像，多模态 encoder 分别提取纯文本特征 ${inline(studentCondition)} 与图文多模态特征 ${inline(teacherCondition)}；student 模型在纯文本条件 ${inline(studentCondition)} 下从高斯噪声出发执行无梯度少步 on-policy 采样得到轨迹状态，随后 student 与 EMA 更新的 teacher 分别在相同轨迹状态上以 ${inline(studentCondition)} 和 ${inline(teacherCondition)} 为条件预测速度场并计算 MSE 自蒸馏损失。`)}
    <p>具体到数学建模上，设参数为 ${inline(theta)} 的 flow matching 模型条件速度场为 ${inline(`${velocity(theta)}<mo>(</mo>${xt}<mo>,</mo><mi>t</mi><mo>,</mo><mi>c</mi><mo>)</mo>`)}，推理遵循常微分方程 ${inline(`<mfrac><mrow><mi>d</mi>${xt}</mrow><mrow><mi>d</mi><mi>t</mi></mrow></mfrac><mo>=</mo>${velocity(theta)}<mo>(</mo>${xt}<mo>,</mo><mi>t</mi><mo>,</mo><mi>c</mi><mo>)</mo>`)}，并由测试阶段一致的少步求解器 ${inline('<mi>Φ</mi>')} 在时间步 ${inline(`<mn>1</mn><mo>=</mo>${tk('<mi>K</mi>')}<mo>&gt;</mo>${tk('<mi>K</mi><mo>−</mo><mn>1</mn>')}<mo>&gt;</mo><mo>⋯</mo><mo>&gt;</mo>${tk('<mn>0</mn>')}<mo>=</mo><mn>0</mn>`)} 上求解。对每组图文对 ${inline(`<mo>(</mo>${x0}<mo>,</mo><mi>y</mi><mo>)</mo>`)}，先构造两路条件：</p>
    ${equation('学生与教师分别接收文本特征和图文特征', `${studentCondition}<mo>=</mo><msub><mi>f</mi><mtext>text</mtext></msub><mo>(</mo><mi>y</mi><mo>)</mo><mo>,</mo><mspace width="2em"/>${teacherCondition}<mo>=</mo><msub><mi>f</mi><mtext>mm</mtext></msub><mo>(</mo><mi>y</mi><mo>,</mo>${x0}<mo>)</mo>`)}
    <p>其中 student 仅接收纯文本特征 ${inline(studentCondition)}，与推理 pipeline 完全一致；参数为 ${inline(thetaBar)} 的 teacher 接收融合文本与目标图像的多模态特征 ${inline(teacherCondition)}。随后从高斯噪声 ${inline(`${state('<mi>K</mi>')}<mo>∼</mo><mi>𝒩</mi><mo>(</mo><mn>0</mn><mo>,</mo><mi>I</mi><mo>)</mo>`)} 出发，由 student 独立采样出少步 on-policy 轨迹 ${inline(trajectory)}：</p>
    ${equation('学生模型的少步采样轨迹', `${state(previous)}<mo>=</mo><mi>sg</mi><mo>(</mo><mi>Φ</mi><mo>(</mo>${state(k)}<mo>,</mo>${tk(k)}<mo>,</mo>${tk(previous)}<mo>,</mo>${velocity(theta)}<mo>(</mo><mo>·</mo><mo>,</mo><mo>·</mo><mo>,</mo>${studentCondition}<mo>)</mo><mo>)</mo><mo>)</mo><mo>,</mo><mspace width="1em"/><mi>k</mi><mo>=</mo><mi>K</mi><mo>,</mo><mo>…</mo><mo>,</mo><mn>1</mn>`)}
    <p>求解器每步输出均施加 stop-gradient 算子 ${inline('<mi>sg</mi><mo>(</mo><mo>·</mo><mo>)</mo>')}，无需跨步反传梯度，显存开销极为友好。接着让 student 与 teacher 在同一批轨迹状态 ${inline(trajectory)} 上分别预测速度场 ${inline(`${prediction('s')}<mo>=</mo>${velocity(theta)}<mo>(</mo>${state(k)}<mo>,</mo>${tk(k)}<mo>,</mo>${studentCondition}<mo>)</mo>`)} 与 ${inline(`${prediction('t')}<mo>=</mo>${velocity(thetaBar)}<mo>(</mo>${state(k)}<mo>,</mo>${tk(k)}<mo>,</mo>${teacherCondition}<mo>)</mo>`)}。由于 flow matching 输出连续速度场而非离散词表分布，D-OPSD 通过 MSE 拉近两者的预测：</p>
    ${equation('D-OPSD 速度场均方误差损失', `${loss}<mo>=</mo><msub><mi>𝔼</mi><mrow><mo>(</mo>${x0}<mo>,</mo><mi>y</mi><mo>)</mo></mrow></msub><mo>[</mo><mfrac><mn>1</mn><mi>K</mi></mfrac><munderover><mo>∑</mo><mrow><mi>k</mi><mo>=</mo><mn>1</mn></mrow><mi>K</mi></munderover><msubsup><mrow><mo>‖</mo>${prediction('s')}<mo>−</mo><mi>sg</mi><mo>(</mo>${prediction('t')}<mo>)</mo><mo>‖</mo></mrow><mn>2</mn><mn>2</mn></msubsup><mo>]</mo>`)}
    <p>训练时通过最小化 ${inline(loss)} 更新 ${inline(theta)}，并用 EMA 更新 ${inline(thetaBar)}；训练结束后直接丢弃 teacher 分支，推理维持原版纯文本少步生成，零额外耗时。</p>
    <p>在工程落地层面，有两项关键设计保障了自蒸馏的稳定性：</p>
    <ul>
      <li><strong>混合权重拼接的多模态 encoder 特征对齐</strong>：Z-Image-Turbo 与 FLUX.2-klein 原本使用 Qwen3-4B 编码文本，若给 teacher 直接替换为 <a href="https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct">Qwen3-VL-4B</a>，因其多模态训练后输出 hidden states 分布发生漂移，会导致生成图像出现高频噪点与过度锐化。作者保留了 Qwen3-VL-4B 中的 visual encoder（ViT）与 connector 权重，而将内部 LLM 参数替换回原版 Qwen3-4B，相当于把 VLM 回退到刚完成 connector 对齐的阶段，兼顾了多模态感知与特征空间兼容，未来切换至 <a href="https://huggingface.co/Qwen/Qwen3.5-4B">Qwen3.5</a> 等原生多模态 encoder 后还将更为顺畅。</li>
      <li><strong>高动量 EMA 更新防止自蒸馏坍塌</strong>：teacher 需采用 0.9999 高动量 EMA 更新以防自蒸馏过程中的模式退化；在 <a href="https://arxiv.org/abs/2106.09685">LoRA</a> 微调时只需驻留一份 frozen 基座并对轻量级 LoRA 权重做 EMA，单张 H800 即可完成训练。</li>
    </ul>

    <h2 id="results">三、从实验表现看 D-OPSD 带来的实质性增益</h2>
    <p>D-OPSD 在 6B 的 Z-Image-Turbo（8 步）与 4B 的 FLUX.2-klein（4 步）上分别测试了小样本 LoRA 定制与大规模全量微调，实验数据直观地验证了其实用价值。</p>
    ${figure(3, '小样本 LoRA 定制的训练样本与各方法生成结果', '小样本 LoRA 定制（主体概念与风格迁移）定性对比。Vanilla SFT 在 8 步采样下出现明显模糊与雾化伪影；PSO 对少数几张训练图像发生严重 overfitting，无法响应新场景文本描述（如玻璃观景台、水下森林等）；D-OPSD 在精准保持目标主体外观或艺术风格的同时，完好保留了少步高画质与复杂文本指令遵循能力。')}
    <p>在小样本 LoRA 定制设定下（30 个主体类与 10 个风格类，每类约 4 张图，单卡 H800 训练 1000 步），D-OPSD 解决了「学习新概念导致少步画质退化」的顽疾。以 Z-Image-Turbo 为例，vanilla SFT 与 DreamBooth 虽然能降低主体相似度指标 <a href="https://github.com/facebookresearch/dinov3">DINOv3</a> 距离（DINO-D）和 <a href="https://github.com/richzhang/PerceptualSimilarity">LPIPS</a> 距离，但 Quality-S 从基座的 3.5088 暴跌至 2.4236 和 2.5582，Aesthetic-S 也从 2.9667 跌至 2.35 附近，8 步生成画面严重模糊。针对社区常见的「先在未蒸馏的多步基座上训好 LoRA、再直接挂载到少步模型上」这一跨模型挂载 baseline，论文实验证实它虽然保住了少步画质（Quality-S 为 3.6081），但概念迁移效果大幅衰减，VLM 一致性评分（VLM-J）在 Z-Image-Turbo 上仅有 1.8525，在 FLUX.2-klein 上更是掉回 1.0000，基本未能注入新概念。另一类 baseline PSO 虽把 DINO-D 刷到了 0.0570，但 CLIPCLIP-S 图文对齐分却从 0.3043 倒退至 0.2893，原因在于 PSO 对区区几张训练图发生了严重 overfitting，更换新场景 prompt 便无法响应背景变化。反观 D-OPSD，在将 DINO-D 压至 0.0823、VLM-J 提升到 3.3333 的同时，Quality-S 与 Aesthetic-S 反升至 3.7965 与 3.1710，CLIP-S 也达到全场最高的 0.3664，能将新概念自然泛化到未知场景中，4 步 FLUX.2-klein 上同样复现了这一优势。</p>
    ${figure(4, '动漫微调域与原始写实域的生成效果对照', '大规模全量微调（25K 高质量动漫数据集）定性对比。左侧为目标微调域（新知识获取），右侧为原始写实与文字渲染域（先验知识保持）。SFT 与 PSO 不仅在动漫域产生涂抹伪影，在原始写实域与图像内文字渲染上更发生严重的灾难性遗忘；D-OPSD 在习得细腻动漫风格的同时，完整保留了原模型的写实画质与英文排版能力。')}
    <p>在 25K 高质量动漫数据集的全参数微调中（32 张 H800 训练 10K 步），D-OPSD 展现出的第二点帮助是在大规模 domain adaptation 中抑制了灾难性遗忘。全量微调下 vanilla SFT 和 PSO 双双失灵，在 Z-Image-Turbo 上不仅 FID 恶化至 82.20 和 88.43（逊于基座的 48.69），衡量组合生成与语义遵循的 <a href="https://github.com/djghosh13/geneval">GenEval</a> 更是从 0.7543 断崖跌至 0.1588 和 0.2475；FLUX.2-klein 运行 SFT 后 GenEval 同样从 0.8155 跌至 0.1113，<a href="https://github.com/TencentQQGYLab/ELLA">DPG</a> 从 85.56 跌至 56.21。而 D-OPSD 在两款基座上将动漫域 FID 大幅降至 40.49 与 38.29，Quality-S 均突破 3.83，同时 Z-Image-Turbo 的 GenEval 保持在 0.7170、DPG 高达 84.11（几乎持平基座的 84.76），并在 100 组 prompt 人工盲测 user study 的画质、美感与指令遵循上全面胜出。下表汇总了 Z-Image-Turbo（8 步）在 LoRA 定制与全参数微调下的核心量化对比：</p>
    ${figure(5, '训练策略与教师模型构建的消融实验曲线', 'D-OPSD 核心组件的 ablation study 训练演化曲线：（a）训练策略对比表明，自蒸馏监督遏制了少步图像质量随训练步数下滑的趋势，而 on-policy 轨迹采样相比 off-policy 蒸馏大幅加速了 DINO 相似度收敛并推高了画质上限；（b）Teacher 构建方式对比证实，采用 0.9999 高动量 EMA 更新能有效避免 student 直接复制导致的自蒸馏坍塌。')}
    <p>此外，如上图所示的 ablation study 与算力账单进一步印证了其工程性价比。对照 ablation study 表明，自蒸馏监督止住了少步画质随训练下滑的趋势，而 on-policy 采样则大幅加快了概念收敛并提升了相似度上限。虽然 D-OPSD 因包含无梯度 roll-out 与 teacher 前向预测，单步 FLOPs 约为 SFT 的 4 倍、单步耗时约 2 倍，但对比「多步基座 SFT + DMD 重蒸馏」的二阶段 pipeline，LoRA 定制下二阶段方案需消耗 887 个（5+882）H800 GPU 小时，单阶段 D-OPSD 仅需 9 个 GPU 小时，节省近两个数量级算力且 Quality-S（3.7965 对比 3.3372）更高；全量微调下 D-OPSD 耗时 1918 个 GPU 小时，同样低于二阶段的 3120 个（1066+2054）GPU 小时，且 GenEval 领先超过 10 个百分点。</p>
  `;
})();
