# pm/firecracker

Firecracker microVM lifecycle management with local and remote SSH support.

## Capabilities

- Create, start, stop, delete Firecracker microVMs
- Execute commands inside VMs via SSH
- Track VMs in a local registry with automatic stale cleanup
- Local mode (Linux with KVM) and remote mode (SSH to Linux host)
- Per-VM logging and status tracking

## Prerequisites

### Local mode (Linux)
- `/dev/kvm` accessible (Intel VT-x or AMD-V)
- `firecracker` binary in PATH
- Kernel image (uncompressed vmlinux)
- Root filesystem (ext4 image with SSH server)

### Remote mode (macOS → Linux)
- SSH access to a Linux host with Firecracker installed
- Configure `remote_host` in config.json or pass at init

## Usage

### Python
```python
import mod as m
fc = m.mod('pm/firecracker')()

fc.health()                                          # check prerequisites
fc.create(name='web', memory=1024, vcpus=2)          # create VM
fc.list()                                            # list all VMs
fc.exec(vm_id='web-1234567', command='uname -a')     # run command
fc.stop(vm_id='web-1234567')                         # stop VM
fc.delete(vm_id='web-1234567')                       # delete VM
fc.logs(vm_id='web-1234567', lines=100)              # view logs
```

### CLI
```bash
m pm/firecracker                                      # status
m pm/firecracker/health                               # prerequisites check
m pm/firecracker/create name=web memory=1024 vcpus=2  # create VM
m pm/firecracker/list                                 # list VMs
m pm/firecracker/exec vm_id=web-1234567 command=ls    # exec in VM
m pm/firecracker/stop vm_id=web-1234567               # stop
m pm/firecracker/delete vm_id=web-1234567             # delete
m pm/firecracker/logs vm_id=web-1234567               # logs
```

## API

| Function | Args | Description |
|----------|------|-------------|
| `forward` | — | Default → status |
| `health` | — | Prerequisites + VM count |
| `status` | — | Aggregate VM stats |
| `create` | name, memory=512, vcpus=1, kernel, rootfs, ssh_port | Create & start VM |
| `list` | — | List all VMs |
| `get` | vm_id | Single VM details |
| `stop` | vm_id | Stop running VM |
| `delete` | vm_id | Stop + remove VM |
| `exec` | vm_id, command | Run command in VM via SSH |
| `logs` | vm_id, lines=50 | View VM console logs |

## Structure

```
mod/orbit/pm/firecracker/
├── mod.py           # Mod class
├── config.json      # Module config
├── skill.md         # This file
└── test/
    └── test_firecracker.py
```

## Storage

- Registry: `~/.firecracker/vms.json`
- Sockets: `~/.firecracker/sockets/`
- Logs: `~/.firecracker/logs/`

## Mod Protocol

- Module: `pm/firecracker`
- Load: `m.mod('pm/firecracker')()`
- Config: `config.json` in module root
