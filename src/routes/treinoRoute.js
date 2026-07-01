import auth from "../middlewares/auth.js";
import express from "express";
import prisma from "../../prisma/client.js";

const router = express.Router();

const formatBigInt = (data) =>
  JSON.parse(
    JSON.stringify(data, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );

// Criar treino
router.post("/", async (req, res) => {
  try {
    const professor_id = req.usuario.professor_id;
    const { nome, descricao, aluno_id, fichas_ids } = req.body;

    if (!professor_id) {
      return res.status(403).json({
        error: "Apenas professores podem criar treinos.",
      });
    }

    if (!nome?.trim()) {
      return res.status(400).json({
        error: "O nome do treino é obrigatório.",
      });
    }

    if (!aluno_id || isNaN(Number(aluno_id))) {
      return res.status(400).json({
        error: "O aluno informado é inválido.",
      });
    }

    if (!Array.isArray(fichas_ids) || fichas_ids.length === 0) {
      return res.status(400).json({
        error: "Selecione pelo menos uma ficha para o treino.",
      });
    }

    const aluno = await prisma.aluno.findUnique({
      where: {
        id: BigInt(aluno_id),
      },
    });

    if (!aluno) {
      return res.status(404).json({
        error: "Aluno não encontrado.",
      });
    }

    const fichas = await prisma.fichaTreino.findMany({
      where: {
        id: {
          in: fichas_ids.map((id) => BigInt(id)),
        },
        professor_id: BigInt(professor_id),
      },
    });

    if (fichas.length !== fichas_ids.length) {
      return res.status(400).json({
        error: "Uma ou mais fichas não existem ou não pertencem a este professor.",
      });
    }

    const treino = await prisma.treino.create({
      data: {
        nome: nome.trim(),
        descricao: descricao?.trim() || null,
        aluno_id: BigInt(aluno_id),
        professor_id: BigInt(professor_id),

        fichasVinculadas: {
          create: fichas_ids.map((ficha_id) => ({
            ficha: {
              connect: {
                id: BigInt(ficha_id),
              },
            },
          })),
        },
      },
      include: {
        aluno: {
          include: {
            usuario: {
              select: {
                nome: true,
                email: true,
              },
            },
          },
        },
        fichasVinculadas: {
          include: {
            ficha: {
              include: {
                grupo: true,
                exercicios: {
                  include: {
                    exercicio: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return res.status(201).json(formatBigInt(treino));
  } catch (error) {
    console.error("Erro ao criar treino:", error);

    return res.status(500).json({
      error: "Erro ao criar treino.",
      message: error.message,
    });
  }
});

// Listar treinos do professor
router.get("/", async (req, res) => {
  try {
    const professor_id = req.usuario.professor_id;

    if (!professor_id) {
      return res.status(403).json({
        error: "Apenas professores podem listar treinos.",
      });
    }

    const treinos = await prisma.treino.findMany({
      where: {
        professor_id: BigInt(professor_id),
      },
      include: {
        aluno: {
          include: {
            usuario: {
              select: {
                nome: true,
                email: true,
              },
            },
          },
        },
        fichasVinculadas: {
  include: {
    ficha: {
      include: {
        grupo: true,
        exercicios: {
          include: {
            exercicio: true,
          },
        },
      },
    },
  },
},
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return res.json(formatBigInt(treinos));
  } catch (error) {
    console.error("Erro ao listar treinos:", error);

    return res.status(500).json({
      error: "Erro ao listar treinos.",
      message: error.message,
    });
  }
});

// Listar treinos do aluno
router.get("/meus-treinos", async (req, res) => {
  try {
    const aluno_id = req.usuario.aluno_id;

    if (!aluno_id) {
      return res.status(403).json({
        error: "Apenas alunos podem visualizar seus treinos.",
      });
    }

    const treinos = await prisma.treino.findMany({
      where: {
        aluno_id: BigInt(aluno_id),
      },
      include: {
        professor: {
          include: {
            usuario: {
              select: {
                nome: true,
                email: true,
              },
            },
          },
        },
        execucoes: {
          where: {
            aluno_id: BigInt(aluno_id),
          },
          orderBy: {
            iniciado_em: "desc",
          },
        },
        fichasVinculadas: {
  include: {
    ficha: {
      include: {
        grupo: true,
        exercicios: {
          include: {
            exercicio: true,
          },
        },
        execucoes: {
          where: {
            aluno_id: BigInt(aluno_id),
          },
          orderBy: {
            iniciado_em: "desc",
          },
        },
      },
    },
  },
},
      },
      orderBy: {
        created_at: "desc",
      },
    });

    const treinosFormatados = treinos.map((treino) => {
  const execucaoTreinoAtual = treino.execucoes.find(
    (execucao) => execucao.status === "EM_ANDAMENTO"
  );

  const fichas = treino.fichasVinculadas.map((vinculo) => {
    const ficha = vinculo.ficha;

    const finalizadaNaExecucaoAtual = ficha.execucoes.some(
      (execucaoFicha) =>
        execucaoFicha.status === "FINALIZADA" &&
        execucaoFicha.execucao_treino_id === execucaoTreinoAtual?.id
    );

    return {
      ...ficha,
      finalizadaNaExecucaoAtual,
    };
  });

  const totalFichas = fichas.length;

  const fichasFinalizadas = fichas.reduce((total, ficha) => {
    return (
      total +
      ficha.execucoes.filter(
        (execucaoFicha) => execucaoFicha.status === "FINALIZADA"
      ).length
    );
  }, 0);

  const treinosFinalizados = treino.execucoes.filter(
    (execucao) => execucao.status === "FINALIZADA"
  ).length;

  return {
    ...treino,
    fichas,
    totalFichas,
    fichasFinalizadas,
    treinosFinalizados,
    treinoFinalizado: treinosFinalizados > 0,
  };
});

    return res.json(formatBigInt(treinosFormatados));
  } catch (error) {
    console.error("Erro ao buscar treinos:", error);

    return res.status(500).json({
      error: "Erro ao buscar treinos.",
      message: error.message,
    });
  }
});

// Buscar treino por ID
router.get("/:id", async (req, res) => {
  try {
    const professor_id = req.usuario.professor_id;
    const { id } = req.params;

    const treino = await prisma.treino.findFirst({
  where: {
    id: BigInt(id),
    professor_id: BigInt(professor_id),
  },
  include: {
    aluno: {
      include: {
        usuario: {
          select: {
            nome: true,
            email: true,
          },
        },
      },
    },
    fichasVinculadas: {
      include: {
        ficha: true,
      },
    },
  },
});

    if (!treino) {
      return res.status(404).json({
        error: "Treino não encontrado.",
      });
    }

    return res.json(formatBigInt(treino));
  } catch (error) {
    return res.status(500).json({
      error: "Erro ao buscar treino.",
      message: error.message,
    });
  }
});

// Editar treino
router.patch("/:id", async (req, res) => {
  try {
    const professor_id = req.usuario.professor_id;
    const { id } = req.params;
    const { nome, descricao, aluno_id, fichas_ids } = req.body;

    if (!Array.isArray(fichas_ids) || fichas_ids.length === 0) {
      return res.status(400).json({
        error: "O treino deve possuir pelo menos uma ficha.",
      });
    }

    const treino = await prisma.treino.findFirst({
      where: {
        id: BigInt(id),
        professor_id: BigInt(professor_id),
      },
    });

    if (!treino) {
      return res.status(404).json({
        error: "Treino não encontrado.",
      });
    }

    const treinoAtualizado = await prisma.$transaction(async (tx) => {
      const atualizado = await tx.treino.update({
        where: {
          id: BigInt(id),
        },
        data: {
          nome: nome?.trim(),
          descricao: descricao?.trim() || null,
          aluno_id: aluno_id ? BigInt(aluno_id) : treino.aluno_id,
        },
      });

      await tx.treinoFicha.deleteMany({
  where: {
    treino_id: BigInt(id),
  },
});

await tx.treinoFicha.createMany({
  data: fichas_ids.map((fichaId) => ({
    treino_id: BigInt(id),
    ficha_id: BigInt(fichaId),
  })),
  skipDuplicates: true,
});

      return atualizado;
    });

    return res.json(formatBigInt(treinoAtualizado));
  } catch (error) {
    return res.status(500).json({
      error: "Erro ao atualizar treino.",
      message: error.message,
    });
  }
});

// Excluir treino
router.delete("/:id", async (req, res) => {
  try {
    const professor_id = req.usuario.professor_id;  
    const { id } = req.params;

    const treino = await prisma.treino.findFirst({
      where: {
        id: BigInt(id),
        professor_id: BigInt(professor_id),
      },
    });

    if (!treino) {
      return res.status(404).json({
        error: "Treino não encontrado.",
      });
    }

    await prisma.$transaction(async (tx) => {
      const execucoesTreino = await tx.execucaoTreino.findMany({
        where: {
          treino_id: BigInt(id),
        },
        select: {
          id: true,
        },
      });

      const execucoesIds = execucoesTreino.map((e) => e.id);

      if (execucoesIds.length > 0) {
        const execucoesFicha = await tx.execucaoFicha.findMany({
          where: {
            execucao_treino_id: {
              in: execucoesIds,
            },
          },
          select: {
            id: true,
          },
        });

        const execucoesFichaIds = execucoesFicha.map((e) => e.id);

        if (execucoesFichaIds.length > 0) {
          await tx.registroTreino.deleteMany({
            where: {
              execucao_id: {
                in: execucoesFichaIds,
              },
            },
          });

          await tx.execucaoFicha.deleteMany({
            where: {
              id: {
                in: execucoesFichaIds,
              },
            },
          });
        }

        await tx.execucaoTreino.deleteMany({
          where: {
            id: {
              in: execucoesIds,
            },
          },
        });
      }

      await tx.treinoFicha.deleteMany({
        where: {
          treino_id: BigInt(id),
        },
      });

      await tx.treino.delete({
        where: {
          id: BigInt(id),
        },
      });
    });

    return res.json({
      success: true,
      message: "Treino excluído com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao excluir treino:", error);

    return res.status(500).json({
      error: "Erro ao excluir treino.",
      message: error.message,
    });
  }
});

export default router;